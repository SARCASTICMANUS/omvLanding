"""Import a city's scraped transport corpus without fabricating coordinates.

Supports the Lucknow scrape CSV shape (stops_ordered JSON plus route metadata)
and an optional GeoJSON FeatureCollection. Imported records are marked provisional
unless --trust-source is explicitly supplied; OSRM road geometry is never treated
as proof that a public-transit route exists.
"""
import csv
import hashlib
import json
import math
from pathlib import Path

from django.contrib.gis.geos import LineString, Point
from django.core.management.base import BaseCommand, CommandError
from django.db import transaction

from transport.models import City, CityAdminConfiguration, Route, Stop


def valid_coordinate(lat, lng):
    try:
        lat, lng = float(lat), float(lng)
    except (TypeError, ValueError):
        return False
    return math.isfinite(lat) and math.isfinite(lng) and -90 <= lat <= 90 and -180 <= lng <= 180 and not (lat == 0 and lng == 0)


def load_route_features(path):
    if not path:
        return {}
    data = json.loads(Path(path).read_text(encoding="utf-8-sig"))
    features = data.get("features", []) if isinstance(data, dict) else []
    result = {}
    for feature in features:
        props = feature.get("properties") or {}
        geometry = feature.get("geometry") or {}
        coords = geometry.get("coordinates") or []
        if geometry.get("type") == "LineString" and len(coords) >= 2:
            keys = (props.get("route_name"), props.get("name"), props.get("route_code"), props.get("route_id"))
            for key in keys:
                normalized = str(key or "").strip().casefold()
                if normalized:
                    result[normalized] = (coords, props)
    return result


class Command(BaseCommand):
    help = "Import scraped route-stop candidates into a city without placeholder geometry."

    def add_arguments(self, parser):
        parser.add_argument("--csv", required=True, help="Scraped stops/routes CSV file.")
        parser.add_argument("--geojson", help="Optional route GeoJSON FeatureCollection.")
        parser.add_argument("--city", required=True, help="City name/slug.")
        parser.add_argument("--state", default="Uttar Pradesh")
        parser.add_argument("--dry-run", action="store_true")
        parser.add_argument("--trust-source", action="store_true",
                            help="Mark coordinates verified and routes public. Only use after source validation.")

    def handle(self, *args, **opts):
        csv_path = Path(opts["csv"])
        if not csv_path.is_file():
            raise CommandError(f"CSV file not found: {csv_path}")
        with csv_path.open(encoding="utf-8-sig", newline="") as stream:
            rows = list(csv.DictReader(stream))
        if not rows:
            raise CommandError("CSV has no data rows.")
        route_features = load_route_features(opts.get("geojson"))
        city_key = opts["city"].strip()
        if not city_key:
            raise CommandError("--city cannot be empty.")

        # Parse first; invalid rows are counted and skipped, never guessed.
        grouped = {}
        global_candidates = {}
        rejected = 0
        source_stops = 0
        for row_index, row in enumerate(rows, start=2):
            route_name = (row.get("route_name") or row.get("route") or row.get("name") or "").strip()
            route_code = (row.get("route_code") or row.get("route_id") or "").strip()[:50]
            raw_stops = row.get("stops_ordered")
            if raw_stops:
                try:
                    stop_list = json.loads(raw_stops)
                except (TypeError, json.JSONDecodeError):
                    rejected += 1
                    continue
                if not isinstance(stop_list, list) or len(stop_list) < 2 or not route_name:
                    rejected += 1
                    continue
                parsed = []
                for seq, item in enumerate(stop_list, start=1):
                    if not isinstance(item, dict):
                        continue
                    name = str(item.get("name") or item.get("stop_name") or "").strip()[:255]
                    lat, lng = item.get("lat", item.get("latitude")), item.get("lng", item.get("lon", item.get("longitude")))
                    if not name or not valid_coordinate(lat, lng):
                        continue
                    parsed.append({"name": name, "lat": float(lat), "lng": float(lng),
                                   "sequence": int(item.get("sequence") or seq)})
                parsed.sort(key=lambda item: item["sequence"])
                # Do not turn a single point into a route.
                if len(parsed) < 2 or len({x["sequence"] for x in parsed}) != len(parsed):
                    rejected += 1
                    continue
                grouped.setdefault((route_name, route_code), parsed)
                source_stops += len(parsed)
            else:
                # Flat named-stop CSVs can seed the city's stop catalogue, but
                # without route membership they must not be treated as routes.
                name = str(row.get("stop_name") or row.get("name") or "").strip()[:255]
                lat, lng = row.get("lat", row.get("latitude")), row.get("lng", row.get("lon", row.get("longitude")))
                if name and valid_coordinate(lat, lng):
                    key = (name.casefold(), round(float(lat), 6), round(float(lng), 6))
                    global_candidates[key] = {"name": name, "lat": float(lat), "lng": float(lng)}
                else:
                    rejected += 1

        if not grouped and not global_candidates:
            raise CommandError("No usable route stops or named stops found in CSV.")

        missing_geometry = [
            route_name for route_name, route_code in grouped
            if route_name.casefold() not in route_features
            and (not route_code or route_code.casefold() not in route_features)
        ]
        if missing_geometry:
            sample = ", ".join(missing_geometry[:5])
            raise CommandError(
                "Source LineString geometry is required for every route; matching GeoJSON was "
                f"not found for: {sample}. Pass --geojson with route_name/name/route_code properties."
            )

        status_value = "verified" if opts["trust_source"] else "provisional"
        public_value = bool(opts["trust_source"])
        self.stdout.write(f"Rows={len(rows)} route_candidates={len(grouped)} "
                          f"route_stop_instances={source_stops} global_stop_candidates={len(global_candidates)} "
                          f"rejected_rows={rejected} coordinate_status={status_value}")
        if opts["dry_run"]:
            self.stdout.write(self.style.WARNING("DRY RUN: database unchanged."))
            return

        with transaction.atomic():
            city = (City.objects.filter(slug__iexact=city_key).first()
                    or City.objects.filter(name__iexact=city_key).first())
            if city is None:
                center = Point(80.9462, 26.8467, srid=4326) if city_key.casefold() in ("lucknow", "lko") else None
                city = City.objects.create(name=city_key.title(), state=opts["state"], country="India", location=center)
            CityAdminConfiguration.objects.get_or_create(city=city, defaults={"is_active": True})

            created_routes = created_stops = updated_stops = duplicates = 0
            source_hash = hashlib.sha256(csv_path.read_bytes()).hexdigest()
            for (route_name, route_code), stop_items in grouped.items():
                # Route geometry is always sourced from the matching GeoJSON;
                # stop coordinates alone do not prove the vehicle's path.
                feature = route_features.get(route_name.casefold()) or (route_features.get(route_code.casefold()) if route_code else None)
                coords = feature[0]
                coords = [(float(pair[0]), float(pair[1])) for pair in coords
                          if isinstance(pair, (list, tuple)) and len(pair) >= 2
                          and valid_coordinate(pair[1], pair[0])]
                if len(coords) < 2:
                    rejected += 1
                    continue
                route = (Route.objects.filter(city=city, route_code=route_code).first() if route_code else None)
                if route is None:
                    route = Route.objects.filter(city=city, name__iexact=route_name).first()
                is_new = route is None
                if is_new:
                    route = Route(city=city, name=route_name, route_code=route_code)
                    created_routes += 1
                route.name = route_name
                route.route_code = route_code
                route.path = LineString(coords, srid=4326)
                route.start_name = stop_items[0]["name"]
                route.end_name = stop_items[-1]["name"]
                route.total_distance_meters = 0
                route.is_public = public_value
                route.save()

                existing = {stop.order: stop for stop in route.stops.all()}
                for item in stop_items:
                    point = Point(item["lng"], item["lat"], srid=4326)
                    stop = existing.get(item["sequence"])
                    if stop and stop.name.casefold() == item["name"].casefold():
                        if stop.location.distance(point) < 0.000001:
                            duplicates += 1
                            continue
                    if stop is None:
                        Stop.objects.create(route=route, city=city, name=item["name"], location=point,
                                            order=item["sequence"], coordinate_status=status_value,
                                            serviceability_reason="Imported scraped route-stop candidate; verify before enabling boarding.")
                        created_stops += 1
                    else:
                        stop.name = item["name"]
                        stop.location = point
                        stop.city = city
                        stop.coordinate_status = status_value
                        stop.serviceability_reason = "Imported scraped route-stop candidate; verify before enabling boarding."
                        stop.save(update_fields=["name", "location", "city", "coordinate_status", "serviceability_reason"])
                        updated_stops += 1

            for item in global_candidates.values():
                existing = Stop.objects.filter(city=city, route__isnull=True, name__iexact=item["name"],
                                               coordinate_status=status_value).first()
                if existing:
                    duplicates += 1
                    continue
                Stop.objects.create(city=city, route=None, is_global=True, name=item["name"],
                                    location=Point(item["lng"], item["lat"], srid=4326),
                                    coordinate_status=status_value,
                                    serviceability_reason="Imported named-stop candidate; route membership not supplied.")
                created_stops += 1

        self.stdout.write(self.style.SUCCESS(
            f"Imported to {city.name}: routes_created={created_routes}, stops_created={created_stops}, "
            f"stops_updated={updated_stops}, duplicates_skipped={duplicates}, rejected={rejected}, "
            f"source_sha256={source_hash}. Public/verified={opts['trust_source']}."
        ))
