"""Admin and dynamic-route APIs used by the web and mobile clients."""
import csv
import io
import hashlib
import json
import logging
from uuid import UUID
from decimal import Decimal, InvalidOperation, ROUND_HALF_UP

from django.contrib.gis.db.models.functions import Distance
from django.contrib.gis.geos import LineString, Point
from django.contrib.gis.measure import D
from django.db import transaction
from django.db.models import Q
from django.utils.text import slugify
from rest_framework import serializers, status
from rest_framework.parsers import JSONParser, FormParser, MultiPartParser
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from accounts.permissions import IsAdmin
from transport.api.serializers import RouteDetailSerializer
from transport.models import City, CityAdminConfiguration, Route, Stop
from transport.services.osrm_service import OSRMService

logger = logging.getLogger(__name__)


class CoordinateSerializer(serializers.Serializer):
    lat = serializers.FloatField(min_value=-90, max_value=90)
    lng = serializers.FloatField(min_value=-180, max_value=180)
    label = serializers.CharField(required=False, allow_blank=True, max_length=255)


class DynamicRouteInputSerializer(serializers.Serializer):
    city_id = serializers.UUIDField(required=False, allow_null=True)
    origin = CoordinateSerializer()
    destination = CoordinateSerializer()
    vehicle_type = serializers.ChoiceField(choices=("bike", "auto"), default="bike")

    def validate(self, attrs):
        a, b = attrs["origin"], attrs["destination"]
        if a["lat"] == b["lat"] and a["lng"] == b["lng"]:
            raise serializers.ValidationError({"destination": "Origin and destination must differ."})
        return attrs


def _resolve_city(request, city_id, origin=None):
    if city_id:
        try:
            city = City.objects.get(pk=city_id)
        except City.DoesNotExist:
            raise serializers.ValidationError({"city_id": "City not found."})
        config = CityAdminConfiguration.objects.filter(city=city).first()
        if config and not config.is_active:
            raise serializers.ValidationError({"city_id": "This city is inactive for routing."})
        return city
    # Some account deployments have a city FK; only use it when it resolves to a City.
    user_city_id = getattr(request.user, "city_id", None)
    if user_city_id:
        city = City.objects.filter(pk=user_city_id).first()
        if city:
            config = CityAdminConfiguration.objects.filter(city=city).first()
            if config and not config.is_active:
                raise serializers.ValidationError({"city_id": "This city is inactive for routing."})
            return city

    # Mobile location searches provide coordinates but often do not have a
    # city_id (recent-searches stores pickup/destination only). Resolve the
    # service city from the pickup coordinate instead of rejecting a valid
    # route just because the account has no city assigned.
    if origin:
        point = Point(origin["lng"], origin["lat"], srid=4326)
        nearest = (
            City.objects.filter(location__isnull=False)
            .annotate(distance=Distance("location", point))
            .order_by("distance")
            .first()
        )
        if nearest and nearest.distance is not None and nearest.distance <= D(km=100):
            config = CityAdminConfiguration.objects.filter(city=nearest).first()
            if config and not config.is_active:
                raise serializers.ValidationError({"city_id": "The nearest service city is inactive for routing."})
            return nearest

    # Some deployments have not populated City.location yet. If exactly one
    # city is configured and active, it is unambiguous and safe to use as the
    # service city; never guess when multiple cities are available.
    configured_cities = City.objects.filter(admin_configuration__is_active=True).distinct()
    if configured_cities.count() == 1:
        return configured_cities.first()

    raise serializers.ValidationError({
        "city_id": "Unable to determine a service city from your account or pickup location. Please select a supported city."
    })


def _route_payload(city, origin, destination, vehicle_type, persist=False):
    coordinates = [(origin["lng"], origin["lat"]), (destination["lng"], destination["lat"])]
    result = OSRMService.route(*coordinates, geometries="geojson", overview="full", steps=False)
    routes = (result or {}).get("routes") or []
    if not routes:
        return None, Response({"success": False, "message": "Road routing is unavailable for these coordinates. Please retry later or choose nearby points."}, status=status.HTTP_502_BAD_GATEWAY)

    best = routes[0]
    geometry = (best.get("geometry") or {}).get("coordinates") or []
    if len(geometry) < 2:
        return None, Response({"success": False, "message": "Routing provider returned invalid route geometry."}, status=status.HTTP_502_BAD_GATEWAY)

    distance_m = round(float(best.get("distance") or 0), 2)
    duration_s = round(float(best.get("duration") or 0), 2)
    path = LineString([tuple(pair) for pair in geometry], srid=4326)
    vehicle_type = vehicle_type or "bike"
    city_config = CityAdminConfiguration.objects.filter(city=city, is_active=True).first()
    if city_config:
        base_fare = Decimal("0")
        rate = Decimal(city_config.fare_per_km)
        platform_fee = Decimal(city_config.platform_fee)
        rounding_rule = city_config.rounding_rule
        currency = city_config.currency
    else:
        # Dynamic Routing is city-priced; the global vehicle-type screen remains
        # available for legacy trip flows but must not override this UI's city rate.
        base_fare = Decimal("0")
        rate = Decimal("8.00")
        platform_fee = Decimal("0")
        rounding_rule = "none"
        currency = "INR"
    distance_km = Decimal(str(distance_m / 1000))
    distance_component = (distance_km * rate).quantize(Decimal("0.01"))
    subtotal = base_fare + distance_component
    if rounding_rule == "nearest_unit":
        subtotal = subtotal.quantize(Decimal("1"), rounding=ROUND_HALF_UP)
    elif rounding_rule == "ceil_unit":
        from decimal import ROUND_CEILING
        subtotal = subtotal.quantize(Decimal("1"), rounding=ROUND_CEILING)
    elif rounding_rule == "floor_unit":
        from decimal import ROUND_FLOOR
        subtotal = subtotal.quantize(Decimal("1"), rounding=ROUND_FLOOR)
    total_fare = (subtotal + platform_fee).quantize(Decimal("0.01"))
    fare = {
        "currency": currency, "distance_km": round(distance_m / 1000, 2),
        "rate_per_km": float(rate), "base_fare": float(base_fare),
        "platform_fee": float(platform_fee),
        "distance_fare": float(distance_component),
        "buddy_fare": float(total_fare), "marshal_earning": float(subtotal),
        "total_fare": float(total_fare), "rounding_rule": rounding_rule,
    }

    # Stops are actual stored boarding points within the city's configured route corridor.
    corridor_m = city_config.corridor_m if city_config else 100
    max_walk_m = city_config.max_walk_to_stop_m if city_config else 1200
    nearby_stops = list(Stop.objects.filter(
        Q(city=city) | Q(route__city=city), location__distance_lte=(path, D(m=corridor_m))
    ).select_related("route", "city").distinct()[:100])
    ordered = []
    for stop in nearby_stops:
        try:
            snapped = path.project(stop.location, normalized=True)
            ordered.append((snapped, stop))
        except Exception:
            continue
    ordered.sort(key=lambda item: item[0])
    stops = [{"id": str(stop.id), "name": stop.name, "sequence": i + 1, "order": i + 1,
              "lat": stop.location.y, "lon": stop.location.x, "lng": stop.location.x,
              "distance_along_route_m": round(float(position) * distance_m, 2),
              "max_walk_to_stop_m": max_walk_m,
              "is_boarding_point": True, "pickup_allowed": True}
             for i, (position, stop) in enumerate(ordered)]

    route_id = None
    if persist:
        start_name = origin.get("label") or "Origin"
        end_name = destination.get("label") or "Destination"
        with transaction.atomic():
            route = Route.objects.create(city=city, name=f"{start_name} → {end_name}",
                route_code="", path=path, start_name=start_name, end_name=end_name,
                total_distance_meters=distance_m, is_public=False)
            Stop.objects.bulk_create([
                Stop(route=route, city=city, name=start_name, location=Point(origin["lng"], origin["lat"], srid=4326), order=0),
                Stop(route=route, city=city, name=end_name, location=Point(destination["lng"], destination["lat"], srid=4326), order=1),
            ])
            route_id = str(route.id)

    route_data = {
        "id": route_id, "name": f"{origin.get('label') or 'Origin'} → {destination.get('label') or 'Destination'}",
        "route_code": "DYNAMIC" if route_id else None,
        "start": {**origin, "lon": origin["lng"]}, "destination": {**destination, "lon": destination["lng"]},
        "geometry": {"type": "LineString", "coordinates": geometry}, "route_geometry": geometry,
        "distance_m": distance_m, "distance_meters": distance_m, "total_distance_meters": distance_m,
        "duration_s": duration_s, "duration_seconds": duration_s, "eta_seconds": duration_s,
        "stops": stops, "stop_count": len(stops),
    }
    return {"route": route_data, "city": {"id": str(city.id), "name": city.name}, "vehicle_type": vehicle_type,
            "distance_m": distance_m, "duration_s": duration_s, "stops": stops, "fare": fare,
            "dynamic_route_id": route_id, "journey_id": route_id}, None


class DynamicRoutePreviewAPIView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        serializer = DynamicRouteInputSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        city = _resolve_city(request, data.get("city_id"), data["origin"])
        payload, error = _route_payload(city, data["origin"], data["destination"], data["vehicle_type"])
        if error:
            return error
        return Response({"success": True, "message": "Dynamic route preview generated.", "data": payload}, status=200)


class DynamicRouteGenerateAPIView(DynamicRoutePreviewAPIView):
    def post(self, request):
        serializer = DynamicRouteInputSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        city = _resolve_city(request, data.get("city_id"), data["origin"])
        payload, error = _route_payload(city, data["origin"], data["destination"], data["vehicle_type"], persist=True)
        if error:
            return error
        return Response({"success": True, "message": "Dynamic route saved.", "data": payload}, status=status.HTTP_201_CREATED)


class AdminStopSummaryAPIView(APIView):
    """Return efficient counts and a paginated summary using Dynamic Routing's filters."""
    permission_classes = [IsAdmin]

    def get(self, request):
        qs = Stop.objects.select_related("city", "route", "route__city").all()
        city_value = request.query_params.get("city")
        if city_value:
            city_query = (
                Q(city__slug__iexact=city_value) | Q(city__name__iexact=city_value) |
                Q(route__city__slug__iexact=city_value) | Q(route__city__name__iexact=city_value)
            )
            try:
                city_id = UUID(str(city_value))
            except (TypeError, ValueError):
                pass
            else:
                city_query |= Q(city_id=city_id) | Q(route__city_id=city_id)
            qs = qs.filter(city_query)
        serviceable = request.query_params.get("serviceable")
        if serviceable == "1":
            qs = qs.filter(location__isnull=False, coordinate_status="verified")
        elif serviceable == "0":
            qs = qs.exclude(location__isnull=False, coordinate_status="verified")
        # Status chips need the complete breakdown; don't constrain the counts to
        # the selected chip. The main list endpoint applies that selected status.
        total = qs.count()
        by_status = {key: qs.filter(coordinate_status=key).count() for key in
                     ("verified", "provisional", "conflict", "unresolved", "legacy_synthetic")}
        serviceable_count = qs.filter(location__isnull=False, coordinate_status="verified").count()
        summary = {
            "total": total, "count": total, "serviceable": serviceable_count,
            "non_serviceable": total - serviceable_count,
            "by_coordinate_status": {"": total, **by_status},
        }
        return Response({"success": True, "data": summary, **summary}, status=200)


class AdminOnboardingAPIView(APIView):
    permission_classes = [IsAdmin]
    parser_classes = [MultiPartParser, FormParser, JSONParser]
    MAX_UPLOAD_BYTES = 10 * 1024 * 1024

    def post(self, request):
        upload = request.FILES.get("file")
        if not upload:
            return Response({"success": False, "message": "Upload a CSV, XLSX or JSON file in the file field."}, status=400)
        if upload.size > self.MAX_UPLOAD_BYTES:
            return Response({"success": False, "message": "Upload must be 10 MB or smaller."}, status=413)
        mode = request.data.get("mode", "validate")
        if mode not in ("validate", "apply"):
            return Response({"success": False, "message": "mode must be validate or apply."}, status=400)
        try:
            raw = upload.read()
            ext = upload.name.lower().rsplit(".", 1)[-1]
            if ext in ("xlsx", "xlsm"):
                from openpyxl import load_workbook
                workbook = load_workbook(io.BytesIO(raw), read_only=True, data_only=True)
                sheet = workbook.active
                values = list(sheet.iter_rows(values_only=True))
                headers = [str(v or "").strip().lower() for v in values[0]] if values else []
                records = [dict(zip(headers, row)) for row in values[1:]]
            elif ext == "json":
                data = json.loads(raw.decode("utf-8-sig"))
                records = data if isinstance(data, list) else data.get("stops", data.get("routes", data.get("data", [])))
                if isinstance(records, dict): records = [records]
                flattened = []
                for record in records:
                    if isinstance(record, dict) and isinstance(record.get("stops"), list):
                        route_name = record.get("route_name") or record.get("name") or record.get("route") or ""
                        route_code = record.get("route_code") or record.get("code") or record.get("bus_number") or ""
                        for stop in record["stops"]:
                            if isinstance(stop, dict):
                                flattened.append({**stop, "route_name": stop.get("route_name") or route_name,
                                                  "route_code": stop.get("route_code") or route_code})
                    else:
                        flattened.append(record)
                records = flattened
            else:
                records = list(csv.DictReader(io.StringIO(raw.decode("utf-8-sig"))))
            records = [dict(row) for row in records if isinstance(row, dict)]
        except Exception as exc:
            logger.info("Invalid onboarding file format: %s", exc)
            return Response({"success": False, "message": "Could not parse the upload. Check that it is valid UTF-8 CSV, XLSX or JSON."}, status=400)

        def field(row, *names):
            lowered = {str(k).strip().lower().replace(" ", "_"): v for k, v in row.items()}
            return next((lowered[n] for n in names if lowered.get(n) not in (None, "")), None)

        valid, invalid = [], []
        for index, row in enumerate(records, start=2):
            name = field(row, "stop_name", "name", "station", "origin", "start_name")
            lat = field(row, "lat", "latitude", "stop_lat")
            lng = field(row, "lng", "lon", "longitude", "stop_lon", "long")
            if name is None or lat is None or lng is None:
                invalid.append({"row": index, "reason": "name and lat/lng columns are required"}); continue
            try:
                lat, lng = float(lat), float(lng)
                if not (-90 <= lat <= 90 and -180 <= lng <= 180): raise ValueError()
                if lat == 0 and lng == 0: raise ValueError("zero coordinates are not a valid stop location")
            except (TypeError, ValueError) as exc:
                reason = str(exc) if str(exc) and str(exc) != "could not convert string to float: ''" else "latitude/longitude are invalid"
                invalid.append({"row": index, "reason": reason if "zero coordinates" in reason else "latitude/longitude are invalid"}); continue
            valid.append({"name": str(name).strip()[:255], "lat": lat, "lng": lng,
                "route_name": str(field(row, "route_name", "route", "line") or "").strip()[:255],
                "route_code": str(field(row, "route_code", "bus_number", "route_number") or "").strip()[:50]})
        if not valid:
            return Response({"success": False, "message": "No valid stop rows found.", "data": {"total": len(records), "valid": 0, "invalid": invalid[:100]}}, status=400)
        city_slug = str(request.data.get("city_slug") or "").strip()
        city_name = str(request.data.get("city_name") or "").strip()
        city = (City.objects.filter(slug__iexact=city_slug).first() or
                City.objects.filter(name__iexact=city_slug).first()) if city_slug else None
        if city is None and city_name:
            city = City.objects.filter(name__iexact=city_name).first()
        if city is None and not city_name:
            return Response({"success": False, "message": "Choose an existing city or enter a new city name."}, status=400)
        existing_names = set()
        if city:
            existing_names = set(Stop.objects.filter(Q(city=city) | Q(route__city=city), name__in=[item["name"] for item in valid]).values_list("name", flat=True))
        unique_names = {item["name"].casefold() for item in valid}
        already_present = sum(1 for item in valid if item["name"] in existing_names)
        warnings = []
        if request.data.get("fare_per_km") not in (None, "") and city is not None:
            warnings.append("Fare per km is only applied when creating a new city; existing city pricing is unchanged by this import.")
        file_hash = hashlib.sha256(raw).hexdigest()
        report = {
            "stage": "validated" if mode == "validate" else "applying", "applied": False,
            "dataset_kind": "route-corpus" if any(item["route_name"] for item in valid) else "stops",
            "source": {"file": upload.name, "file_sha256": file_hash},
            "city": {"name": city.name if city else city_name, "slug": city.slug if city else slugify(city_name)},
            "report": {"rows": len(records), "stop_instances": len(valid), "unique_names": len(unique_names),
                "serviceable": len(valid), "already_present": already_present,
                "would_create": max(0, len(valid) - already_present), "created": 0, "updated": 0,
                "conflicts": invalid[:100], "unresolved": len(invalid),
                "status_breakdown": {"verified": len(valid), "unresolved": len(invalid)}},
            "invalid_count": len(invalid), "invalid": invalid[:100], "warnings": warnings,
            "created": 0, "duplicates": 0, "routes_created": 0,
        }
        if mode == "validate":
            return Response({"success": True, "message": "Dry run completed; no database changes were made.", "data": report}, status=200)

        try:
            with transaction.atomic():
                if city is None:
                    city = City.objects.create(name=city_name)
                    city_defaults = {}
                    if request.data.get("fare_per_km") not in (None, ""):
                        try:
                            fare_rate = Decimal(str(request.data.get("fare_per_km")))
                            if not fare_rate.is_finite() or fare_rate < 0:
                                raise InvalidOperation
                        except (InvalidOperation, TypeError, ValueError):
                            raise ValueError("fare_per_km must be a non-negative number.")
                        city_defaults["fare_per_km"] = fare_rate
                    CityAdminConfiguration.objects.update_or_create(city=city, defaults=city_defaults)
                seen = set()
                grouped_routes = {}
                global_stops = []
                for item in valid:
                    point_key = (item["name"].casefold(), round(item["lat"], 6), round(item["lng"], 6))
                    if item["route_name"]:
                        group_key = (item["route_name"], item["route_code"])
                        key = (group_key, *point_key)
                        if key in seen:
                            report["duplicates"] += 1
                            continue
                        seen.add(key)
                        grouped_routes.setdefault(group_key, []).append(item)
                    else:
                        key = ("global", *point_key)
                        if key in seen or Stop.objects.filter(city=city, route__isnull=True, name__iexact=item["name"], location=Point(item["lng"], item["lat"], srid=4326)).exists():
                            report["duplicates"] += 1
                            continue
                        seen.add(key)
                        global_stops.append(item)

                for (route_name, route_code), points in grouped_routes.items():
                    if len(points) < 2:
                        global_stops.extend(points)
                        continue
                    coords = [(point["lng"], point["lat"]) for point in points]
                    routed = OSRMService.route(*coords, geometries="geojson", overview="full", steps=False)
                    route_rows = (routed or {}).get("routes") or []
                    geometry = ((route_rows[0].get("geometry") or {}).get("coordinates") if route_rows else None)
                    if not geometry or len(geometry) < 2:
                        raise ValueError(f"Road geometry could not be generated for route '{route_name}'.")
                    route = (Route.objects.filter(city=city, route_code=route_code).first() if route_code
                             else Route.objects.filter(city=city, name__iexact=route_name).first())
                    route_created = route is None
                    if route is None:
                        route = Route(city=city, name=route_name, route_code=route_code)
                    route.name = route_name
                    route.route_code = route_code
                    route.path = LineString([tuple(pair) for pair in geometry], srid=4326)
                    route.start_name = points[0]["name"]
                    route.end_name = points[-1]["name"]
                    route.total_distance_meters = round(float(route_rows[0].get("distance") or 0), 2)
                    route.save()
                    existing_stops = list(route.stops.order_by("order"))
                    for index, point in enumerate(points):
                        location = Point(point["lng"], point["lat"], srid=4326)
                        if index < len(existing_stops):
                            stop = existing_stops[index]
                            stop.name, stop.location, stop.city, stop.is_global, stop.order = point["name"], location, city, False, index
                            stop.save(update_fields=["name", "location", "city", "is_global", "order"])
                            report["report"]["updated"] += 1
                        else:
                            Stop.objects.create(route=route, city=city, is_global=False, name=point["name"], location=location, order=index)
                            report["created"] += 1
                    report.setdefault("routes_created", 0)
                    if route_created:
                        report["routes_created"] += 1

                for item in global_stops:
                    Stop.objects.create(city=city, route=None, is_global=True, name=item["name"], location=Point(item["lng"], item["lat"], srid=4326))
                    report["created"] += 1
                report["stage"] = "applied"
                report["applied"] = True
                report["report"]["created"] = report["created"]
                report["report"]["already_present"] = report["duplicates"]
                report["report"]["would_create"] = report["created"]
                report["message"] = f"Imported {report['created']} stops and {report.get('routes_created', 0)} routes into {city.name}; skipped {report['duplicates']} duplicates."
        except ValueError as exc:
            logger.info("Admin onboarding route import rejected: %s", exc)
            return Response({"success": False, "message": str(exc), "data": report}, status=422)
        except Exception:
            logger.exception("Admin onboarding import failed")
            return Response({"success": False, "message": "Import failed; database transaction was rolled back."}, status=500)
        return Response({"success": True, "message": report["message"], "data": report}, status=201)


class RouteByBusNumberAPIView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, bus_number):
        route = Route.objects.filter(route_code__iexact=bus_number).select_related("city").prefetch_related("stops").first()
        if not route:
            return Response({"success": False, "message": "Route not found for this bus/route number."}, status=404)
        return Response({"success": True, "data": RouteDetailSerializer(route).data}, status=200)
