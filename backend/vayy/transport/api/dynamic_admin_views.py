"""Admin and dynamic-route APIs used by the web and mobile clients."""
import hashlib
import json
import logging
from uuid import UUID
from decimal import Decimal, InvalidOperation, ROUND_HALF_UP

from django.contrib.gis.db.models.functions import Distance
from django.contrib.gis.geos import LineString, Point
from django.contrib.gis.measure import D
from django.core import signing
from django.core.signing import BadSignature, SignatureExpired
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
from transport.models import City, CityAdminConfiguration, Route, RouteStopAssociation, Stop
from transport.services.osrm_service import OSRMService
from transport.services.stop_corridor_graph import find_stop_corridor, haversine_m
from transport.services.stop_discovery_service import StopDiscoveryService
from transport.services.city_config import CITY_CENTROID_MATCH_RADIUS_M, CITY_DEFAULTS
from transport.services.admin_import_service import (
    decode_tabular_upload,
    normalize_import_records,
    normalize_master_v1,
    normalize_noida_route_stop_rows,
    parse_geojson_routes,
    parse_master_v1_geojson,
)

logger = logging.getLogger(__name__)
IMPORT_TOKEN_SALT = "transport.admin-onboarding.apply.v1"
IMPORT_TOKEN_MAX_AGE_SECONDS = 1800


def _issue_import_token(request, city_key, digest, schema_version):
    return signing.dumps({
        "user": str(request.user.pk),
        "city": str(city_key),
        "digest": digest,
        "schema_version": str(schema_version),
    }, salt=IMPORT_TOKEN_SALT)


def _verify_import_token(request, token, city_key, digest, schema_version):
    if not token:
        return "Run Dry Run again; Apply requires its validation token."
    try:
        payload = signing.loads(
            token, salt=IMPORT_TOKEN_SALT,
            max_age=IMPORT_TOKEN_MAX_AGE_SECONDS,
        )
    except SignatureExpired:
        return "The Dry Run token expired. Run Dry Run again before applying."
    except BadSignature:
        return "The Dry Run token is invalid. Run Dry Run again before applying."
    expected = {
        "user": str(request.user.pk),
        "city": str(city_key),
        "digest": digest,
        "schema_version": str(schema_version),
    }
    if payload != expected:
        return "The file, geometry, city, or schema changed after Dry Run. Run Dry Run again."
    return None


def _match_imported_global_stop(city, item):
    stops = Stop.objects.filter(city=city, is_global=True)
    if item.get("source_stop_id"):
        identified = list(stops.filter(source_stop_id=item["source_stop_id"])[:2])
        if len(identified) == 1:
            return identified[0]
        if len(identified) > 1:
            return None
    point = Point(item["lng"], item["lat"], srid=4326)
    exact = list(stops.filter(
        Q(name__iexact=item["name"]) | Q(aliases__contains=[item["name"]]),
        location__distance_lte=(point, D(m=1)),
    )[:2])
    return exact[0] if len(exact) == 1 else None


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

    # A city centroid is not its service boundary. A nearby existing global
    # stop is the strongest geographic evidence when resolving this request.
    if origin:
        point = Point(origin["lng"], origin["lat"], srid=4326)
        nearby_stop = Stop.objects.filter(
            city__isnull=False,
            is_global=True,
        ).filter(
            Q(city__admin_configuration__isnull=True)
            | Q(city__admin_configuration__is_active=True)
        ).annotate(distance=Distance("location", point)).order_by("distance", "city_id").first()
        if nearby_stop and nearby_stop.distance.m <= (
            nearby_stop.city.admin_configuration.max_walk_to_stop_m
            if hasattr(nearby_stop.city, "admin_configuration") else 3000
        ):
            return nearby_stop.city

        # Retain the checked-in centroid rule only as a fallback when the stop
        # inventory cannot identify the pickup's city. A supported location
        # near a global stop is never rejected by this centroid radius.
        nearest = City.objects.filter(location__isnull=False).annotate(
            distance=Distance("location", point),
        ).order_by("distance").first()
        nearest_distance = nearest.distance.m if nearest and nearest.distance else None
        if nearest is None or nearest_distance > CITY_CENTROID_MATCH_RADIUS_M:
            fallback_city = None
            fallback_distance = None
            for slug, (lat, lng, _state) in CITY_DEFAULTS.items():
                candidate = City.objects.filter(slug__iexact=slug, location__isnull=True).first()
                if candidate is None:
                    continue
                distance = haversine_m(origin["lat"], origin["lng"], lat, lng)
                if fallback_distance is None or distance < fallback_distance:
                    fallback_city, fallback_distance = candidate, distance
            if fallback_city and fallback_distance <= CITY_CENTROID_MATCH_RADIUS_M:
                nearest, nearest_distance = fallback_city, fallback_distance
        if nearest and nearest_distance is not None and nearest_distance <= CITY_CENTROID_MATCH_RADIUS_M:
            config = CityAdminConfiguration.objects.filter(city=nearest).first()
            if config and not config.is_active:
                raise serializers.ValidationError({"city_id": "The nearest service city is inactive for routing."})
            return nearest

    # Some deployments have not populated City.location yet. If exactly one
    # city is configured and active, it is unambiguous and safe to use as the
    # service city; never guess when multiple cities are available.
    configured_cities = City.objects.filter(admin_configuration__is_active=True).distinct()
    if configured_cities.count() == 1 and origin is None:
        return configured_cities.first()

    raise serializers.ValidationError({
        "city_id": "Unable to determine a service city from your account or pickup location. Please select a supported city."
    })


def _route_payload(city, origin, destination, vehicle_type, persist=False, global_stops=None):
    coordinates = [(origin["lng"], origin["lat"]), (destination["lng"], destination["lat"])]
    result = OSRMService.route(*coordinates, geometries="geojson", overview="full", steps=False)
    routes = (result or {}).get("routes") or []
    if not routes:
        return None, Response({"success": False, "code": "ROUTE_GEOMETRY_UNAVAILABLE", "message": "Road routing is unavailable for these coordinates. Please retry later or choose nearby points."}, status=status.HTTP_502_BAD_GATEWAY)
    if (result or {}).get("waypoints") and not OSRMService._route_snap_is_valid(result):
        return None, Response({
            "success": False, "code": "ROUTE_SNAP_TOO_FAR",
            "message": "The nearest routable road is too far from one of the selected stops.",
        }, status=status.HTTP_502_BAD_GATEWAY)

    best = routes[0]
    geometry = (best.get("geometry") or {}).get("coordinates") or []
    if len(geometry) < 2:
        return None, Response({"success": False, "message": "Routing provider returned invalid route geometry."}, status=status.HTTP_502_BAD_GATEWAY)

    distance_m = round(float(best.get("distance") or 0), 2)
    duration_s = round(float(best.get("duration") or 0), 2)
    path = LineString([tuple(pair) for pair in geometry], srid=4326)
    waypoints = (result or {}).get("waypoints") or []
    snapped_endpoints = []
    for index, coordinate in ((0, geometry[0]), (1, geometry[-1])):
        snap_m = None
        if index < len(waypoints):
            try:
                snap_m = float(waypoints[index]["distance"])
            except (KeyError, TypeError, ValueError):
                pass
        snapped_endpoints.append({"lng": coordinate[0], "lat": coordinate[1], "distance_m": snap_m})
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
    max_walk_m = city_config.max_walk_to_stop_m if city_config else 3000
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
            if global_stops:
                RouteStopAssociation.objects.bulk_create([
                    RouteStopAssociation(route=route, stop=global_stops[0], order=0),
                    RouteStopAssociation(route=route, stop=global_stops[1], order=1),
                ])
            else:
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
        "snapped_endpoints": snapped_endpoints,
        "distance_m": distance_m, "distance_meters": distance_m, "total_distance_meters": distance_m,
        "duration_s": duration_s, "duration_seconds": duration_s, "eta_seconds": duration_s,
        "stops": stops, "stop_count": len(stops),
    }
    return {"route": route_data, "city": {"id": str(city.id), "name": city.name}, "vehicle_type": vehicle_type,
            "distance_m": distance_m, "duration_s": duration_s, "stops": stops, "fare": fare,
            "dynamic_route_id": route_id, "journey_id": route_id}, None



def _corridor_preview_payload(city, origin, destination, vehicle_type, persist=False):
    """Build an OSRM road preview between the best existing global stops."""
    config = CityAdminConfiguration.objects.filter(city=city, is_active=True).first()
    max_walk_m = config.max_walk_to_stop_m if config else 3000
    origin_point = Point(origin["lng"], origin["lat"], srid=4326)
    destination_point = Point(destination["lng"], destination["lat"], srid=4326)
    pickup_candidates = StopDiscoveryService.nearby_global_stops(
        city.id, origin_point, max_walk_m,
    )
    destination_candidates = StopDiscoveryService.nearby_global_stops(
        city.id, destination_point, max_walk_m,
    )
    city_payload = {"id": str(city.id), "name": city.name}

    def empty(reason, message):
        return {
            "routes": [], "city": city_payload,
            "vehicle_type": vehicle_type or "bike",
            "empty_reason": reason, "message": message,
        }, None

    if not pickup_candidates or not destination_candidates:
        return empty(
            "NO_NEARBY_STOPS",
            "No global stop is within the configured pickup distance for one or both locations.",
        )

    walking_route_found = {"pickup": False, "destination": False}

    def best_stop(candidates, point, endpoint):
        best = None
        for stop in candidates:
            # Candidates are straight-distance ordered, which is a lower bound
            # on road distance; once it exceeds the best routed path, later
            # candidates cannot improve the result.
            if best and stop.distance_m.m >= best[1]["distance"]:
                break
            walked = OSRMService.get_walking_path(
                (point.x, point.y), (stop.location.x, stop.location.y),
            )
            walking_route_found[endpoint] = walking_route_found[endpoint] or bool(walked)
            if walked and walked["distance"] <= max_walk_m and (
                best is None or walked["distance"] < best[1]["distance"]
            ):
                best = (stop, walked)
        return best if best else (None, None)

    pickup_stop, first_walk = best_stop(pickup_candidates, origin_point, "pickup")
    destination_stop, last_walk = best_stop(destination_candidates, destination_point, "destination")
    if not all(walking_route_found.values()):
        return None, Response({
            "success": False, "code": "WALKING_DIRECTIONS_UNAVAILABLE",
            "message": "The road router could not provide a path to nearby stops. Please retry.",
        }, status=status.HTTP_502_BAD_GATEWAY)
    if not pickup_stop or not destination_stop:
        return empty(
            "NO_WALKABLE_STOPS",
            "No global stop has a routed access path within the configured pickup distance.",
        )

    start = {"lat": pickup_stop.location.y, "lng": pickup_stop.location.x, "label": pickup_stop.name}
    end = {"lat": destination_stop.location.y, "lng": destination_stop.location.x, "label": destination_stop.name}
    route_preview, error = _route_payload(
        city, start, end, vehicle_type, persist=persist,
        global_stops=(pickup_stop, destination_stop) if persist else None,
    )
    if error:
        return None, error

    route_data = route_preview["route"]
    geometry_points = route_data.get("route_geometry") or []
    if len(geometry_points) < 2:
        return None, Response({
            "success": False, "code": "ROUTE_GEOMETRY_UNAVAILABLE",
            "message": "Routing provider returned invalid route geometry.",
        }, status=status.HTTP_502_BAD_GATEWAY)

    def stop_data(stop, sequence, road_point):
        road_lng, road_lat = road_point["lng"], road_point["lat"]
        return {
            "id": str(stop.pk), "name": stop.name,
            # Display the route's OSRM-snapped boarding point while retaining
            # the canonical global-stop location and ID unchanged.
            "lat": road_lat, "lon": road_lng, "lng": road_lng,
            "global_location": {"lat": stop.location.y, "lng": stop.location.x},
            "road_access_point": {"lat": road_lat, "lng": road_lng,
                                   "snap_distance_m": road_point["distance_m"]},
            "sequence": sequence, "order": sequence - 1,
            "is_global": True, "pickup_allowed": True, "is_boarding_point": True,
        }

    stops = [stop_data(pickup_stop, 1, route_data["snapped_endpoints"][0]),
             stop_data(destination_stop, 2, route_data["snapped_endpoints"][1])]
    route_data.update({
        "id": route_data["id"], "route_code": "OSRM_PREVIEW", "route_source": "osrm_global_stops",
        "city_id": str(city.id), "max_walk_to_stop_m": max_walk_m,
        "preview_only": not persist, "requested_origin": origin, "requested_destination": destination,
        "stops": stops, "stop_count": 2, "pickup_stop": stops[0], "dropoff_stop": stops[1],
        "first_mile": {"distance_meters": round(first_walk["distance"], 2),
                       "duration_seconds": round(first_walk["duration"], 2),
                       "geometry": first_walk["geometry"],
                       "duration_is_estimate": first_walk.get("duration_is_estimate", True)} if first_walk else None,
        "last_mile": {"distance_meters": round(last_walk["distance"], 2),
                      "duration_seconds": round(last_walk["duration"], 2),
                      "geometry": last_walk["geometry"],
                      "duration_is_estimate": last_walk.get("duration_is_estimate", True)} if last_walk else None,
        "first_mile_walk_meters": round(first_walk["distance"], 2) if first_walk else None,
        "last_mile_walk_meters": round(last_walk["distance"], 2) if last_walk else None,
        "first_mile_proximity_meters": round(pickup_stop.distance_m.m, 1),
        "last_mile_proximity_meters": round(destination_stop.distance_m.m, 1),
        "walking_path": first_walk["geometry"],
        "walking_duration_is_estimate": first_walk.get("duration_is_estimate", True),
        "walking_profile": first_walk.get("profile", OSRMService.WALKING_PROFILE or OSRMService.DEFAULT_PROFILE),
        "walking_directions_available": bool(first_walk and last_walk),
    })
    route_preview.update({
        "stops": stops,
        "pickup_stop": stops[0],
        "dropoff_stop": stops[1],
        "first_mile_walk_meters": round(first_walk["distance"], 2) if first_walk else None,
        "last_mile_walk_meters": round(last_walk["distance"], 2) if last_walk else None,
        "first_mile_proximity_meters": round(pickup_stop.distance_m.m, 1),
        "last_mile_proximity_meters": round(destination_stop.distance_m.m, 1),
        "walking_directions_available": bool(first_walk and last_walk),
    })
    return {
        "routes": [route_preview],
        "city": city_payload,
        "vehicle_type": vehicle_type or "bike",
        "walking_directions_available": bool(first_walk and last_walk),
    }, None


class DynamicRoutePreviewAPIView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        serializer = DynamicRouteInputSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        city = _resolve_city(request, data.get("city_id"), data["origin"])
        payload, error = _corridor_preview_payload(city, data["origin"], data["destination"], data["vehicle_type"])
        if error:
            return error
        return Response({"success": True, "message": "Stop-corridor route preview generated.", "data": payload}, status=200)


class DynamicRouteGenerateAPIView(DynamicRoutePreviewAPIView):
    def post(self, request):
        serializer = DynamicRouteInputSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        city = _resolve_city(request, data.get("city_id"), data["origin"])
        payload, error = _corridor_preview_payload(
            city, data["origin"], data["destination"], data["vehicle_type"], persist=True,
        )
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

    def _post_master_v1(self, request, upload, raw, records, geometry_upload, mode):
        selected_city = str(
            request.data.get("city_slug") or request.data.get("city_id") or ""
        ).strip()
        if not selected_city:
            return Response({
                "success": False,
                "message": "Select an existing city to filter this schema version 1 master CSV.",
                "code": "CITY_FILTER_REQUIRED",
            }, status=400)
        city = City.objects.filter(slug__iexact=selected_city).first()
        if city is None:
            return Response({
                "success": False,
                "message": f"No existing city has slug {selected_city!r}; create the city before importing its rows.",
                "code": "CITY_NOT_FOUND",
            }, status=404)

        try:
            groups, errors, excluded_rows = normalize_master_v1(records, city.slug)
        except ValueError as exc:
            return Response({"success": False, "message": str(exc), "code": "MASTER_CSV_SCHEMA_INVALID"}, status=400)

        geometry_raw = b""
        geometries = {}
        geometry_errors = []
        if geometry_upload:
            if geometry_upload.size > self.MAX_UPLOAD_BYTES:
                return Response({"success": False, "message": "Geometry upload must be 10 MB or smaller."}, status=413)
            if not geometry_upload.name.lower().endswith((".geojson", ".json")):
                return Response({"success": False, "message": "Route geometry must be a GeoJSON FeatureCollection."}, status=400)
            try:
                geometry_raw = geometry_upload.read()
                geometries, geometry_errors = parse_master_v1_geojson(geometry_raw)
            except (UnicodeDecodeError, json.JSONDecodeError, ValueError) as exc:
                return Response({"success": False, "message": str(exc), "code": "MASTER_GEOJSON_INVALID"}, status=400)

        for item in geometry_errors:
            if item.get("city_id") in (None, city.slug.casefold()):
                errors.append({"row": f"GeoJSON:{item['row']}", "reason": item["reason"]})

        for (city_id, route_id, direction_id), group in groups.items():
            if group["city_name"].casefold() != city.name.casefold():
                errors.append({
                    "row": group["row_numbers"][0],
                    "reason": f"city_name {group['city_name']!r} does not match selected city {city.name!r}",
                })
            geometry = geometries.get((city_id, route_id))
            if geometry is None:
                errors.append({
                    "row": group["row_numbers"][0],
                    "reason": f"missing GeoJSON LineString for city_id={city_id!r}, route_id={route_id!r}",
                })
            elif geometry["geometry_id"] != group["route_geometry_id"]:
                errors.append({
                    "row": group["row_numbers"][0],
                    "reason": f"route_geometry_id does not match GeoJSON for route {route_id!r}",
                })
            else:
                group["geometry"] = geometry["coordinates"]

        matched_global_stops = 0
        for group in groups.values():
            for item in group["stops"]:
                global_stop = _match_imported_global_stop(city, item)
                if global_stop is None:
                    errors.append({
                        "row": item["row_number"],
                        "reason": f"stop_id {item['source_stop_id']!r} must match one existing global stop by source ID or exact name and coordinates",
                    })
                    continue
                item["global_stop_id"] = global_stop.pk
                matched_global_stops += 1

        digest = hashlib.sha256(raw + b"\0" + geometry_raw).hexdigest()
        selected_stop_rows = sum(len(group["stops"]) for group in groups.values())
        blocking_errors = errors
        report = {
            "stage": "validated" if mode == "validate" else "applying",
            "applied": False,
            "can_apply": bool(groups) and not blocking_errors,
            "schema_version": 1,
            "dataset_kind": "multi-city-route-stop-master",
            "source": {
                "file": upload.name,
                "file_sha256": digest,
                "geometry_file": geometry_upload.name if geometry_upload else None,
            },
            "city": {"name": city.name, "slug": city.slug, "id": str(city.pk)},
            "report": {
                "rows": len(records),
                "selected_city_rows": selected_stop_rows,
                "excluded_city_rows": excluded_rows,
                "routes": len(groups),
                "stop_instances": 0,
                "global_stop_memberships": matched_global_stops,
                "global_stops_unmatched": selected_stop_rows - matched_global_stops,
                "routes_created": 0,
                "stops_created": 0,
                "stops_updated": 0,
                "global_stop_memberships_created": 0,
                "duplicates": 0,
                "unresolved": len(blocking_errors),
                "conflicts": blocking_errors[:200],
            },
            "blocking_errors": blocking_errors[:200],
            "errors": blocking_errors[:200],
            "warnings": [],
        }

        if mode == "validate":
            if report["can_apply"]:
                report["apply_token"] = _issue_import_token(
                    request, city.pk, digest, 1,
                )
            return Response({
                "success": True,
                "message": "Dry Run completed for the selected city; no database changes were made.",
                "data": report,
            }, status=200)

        if blocking_errors or not groups:
            return Response({
                "success": False,
                "message": "Apply blocked: resolve all selected-city validation errors and run Dry Run again.",
                "code": "MASTER_IMPORT_VALIDATION_FAILED",
                "data": report,
            }, status=422)

        token_error = _verify_import_token(
            request,
            request.data.get("apply_token"),
            city.pk,
            digest,
            1,
        )
        if token_error:
            return Response({"success": False, "message": token_error, "code": "DRY_RUN_TOKEN_INVALID"}, status=409)

        try:
            with transaction.atomic():
                for (city_id, source_route_id, source_direction_id), group in groups.items():
                    route = Route.objects.filter(
                        city=city,
                        source_route_id=source_route_id,
                        source_direction_id=source_direction_id,
                    ).first()
                    if route is None:
                        legacy_code = group["route_number"] or source_route_id[:50]
                        legacy_routes = Route.objects.filter(
                            city=city,
                            route_code__iexact=legacy_code,
                            source_route_id="",
                        )
                        if legacy_routes.count() == 1:
                            route = legacy_routes.first()
                    is_new = route is None
                    if route is None:
                        route = Route(city=city)

                    route.name = group["route_name"]
                    route.route_code = (group["route_number"] or source_route_id)[:50]
                    route.source_route_id = source_route_id
                    route.source_direction_id = source_direction_id
                    route.route_number = group["route_number"]
                    route.direction_name = group["direction_name"]
                    route.route_geometry_id = group["route_geometry_id"]
                    route.source_name = group["stops"][0]["source_name"]
                    route.source_reference = group["stops"][0]["source_reference"]
                    route.path = LineString(group["geometry"], srid=4326)
                    route.start_name = group["stops"][0]["name"]
                    route.end_name = group["stops"][-1]["name"]
                    route.is_public = False
                    route.save()
                    report["report"]["routes_created"] += int(is_new)

                    RouteStopAssociation.objects.filter(route=route).delete()
                    RouteStopAssociation.objects.bulk_create([
                        RouteStopAssociation(
                            route=route,
                            stop_id=item["global_stop_id"],
                            order=item["sequence"],
                            boarding_allowed=item["boarding_allowed"],
                            alighting_allowed=item["alighting_allowed"],
                        ) for item in group["stops"]
                    ])
                    report["report"]["global_stop_memberships_created"] += len(group["stops"])

                report["applied"] = True
                report["can_apply"] = False
                report["stage"] = "applied"
                report["message"] = (
                    f"Imported {len(groups)} private routes and {report['report']['global_stop_memberships_created']} memberships to existing global stops into {city.name}."
                )
        except Exception:
            logger.exception("Admin schema v1 master import failed; transaction rolled back")
            return Response({
                "success": False,
                "message": "Import failed; the database transaction was rolled back. Review the server error log.",
                "code": "MASTER_IMPORT_ROLLED_BACK",
            }, status=500)

        return Response({"success": True, "message": report["message"], "data": report}, status=201)

    def _post_noida_route_stops(self, request, upload, raw, records, mode):
        selected_city = str(request.data.get("city_slug") or "").strip()
        if selected_city.casefold() != "noida":
            return Response({
                "success": False,
                "message": "Select the existing Noida city before importing route-stop rows.",
                "code": "NOIDA_CITY_REQUIRED",
            }, status=400)

        city = City.objects.filter(slug__iexact="noida").first()
        if city is None:
            return Response({
                "success": False,
                "message": "The Noida city record does not exist. Create it in Admin before importing routes.",
                "code": "NOIDA_CITY_NOT_FOUND",
            }, status=404)

        extension = upload.name.rsplit(".", 1)[-1].lower() if "." in upload.name else ""
        if extension not in ("csv", "xlsx", "xlsm"):
            return Response({
                "success": False,
                "message": "The Noida route-stop importer accepts CSV, XLSX, or XLSM files.",
                "code": "NOIDA_FILE_TYPE_UNSUPPORTED",
            }, status=400)

        try:
            groups, errors, valid_rows, routes_detected = normalize_noida_route_stop_rows(
                records, (city.slug, city.pk),
            )
        except ValueError as exc:
            return Response({"success": False, "message": str(exc), "code": "NOIDA_CSV_SCHEMA_INVALID"}, status=400)

        unmatched = []
        for group in groups.values():
            for item in group["stops"]:
                matched = _match_imported_global_stop(city, {
                    "source_stop_id": item["stop_id"], "name": item["name"],
                    "lat": item["latitude"], "lng": item["longitude"],
                })
                if matched is None:
                    unmatched.append({
                        "row": item["row"],
                        "reason": f"stop_id {item['stop_id']!r} must match one existing Noida global stop before import",
                    })
                else:
                    item["global_stop_id"] = matched.pk
        errors.extend(unmatched)
        digest = hashlib.sha256(raw).hexdigest()
        total_rows = len(records)
        report = {
            "stage": "validated" if mode == "validate" else "applying",
            "applied": False,
            "can_apply": bool(groups) and not unmatched,
            "dataset_kind": "noida-route-stop-rows",
            "source": {"file": upload.name, "file_sha256": digest},
            "city": {"name": city.name, "slug": city.slug, "id": str(city.pk)},
            "report": {
                "rows": total_rows,
                "valid_rows": valid_rows,
                "invalid_rows": total_rows - valid_rows,
                "routes_detected": routes_detected,
                "routes_valid": len(groups),
                "stops_imported": 0,
                "global_stop_memberships": sum(len(group["stops"]) for group in groups.values()) - len(unmatched),
                "global_stops_unmatched": len(unmatched),
                "routes_imported": 0,
                "stops_created": 0,
                "stops_updated": 0,
                "routes_created": 0,
                "errors": errors[:200],
            },
            "errors": errors[:200],
            "warnings": [],
        }

        if mode == "validate":
            if report["can_apply"]:
                report["apply_token"] = _issue_import_token(
                    request, city.pk, digest, "noida-route-stops-v1",
                )
            return Response({
                "success": True,
                "message": "Preview completed; no database changes were made.",
                "data": report,
            }, status=200)

        if not groups or unmatched:
            return Response({
                "success": False,
                "message": "Import blocked: every route stop must match one existing global stop, and each direction needs at least two valid stops.",
                "code": "NOIDA_IMPORT_HAS_NO_VALID_ROUTES",
                "data": report,
            }, status=422)

        token_error = _verify_import_token(
            request,
            request.data.get("apply_token"),
            city.pk,
            digest,
            "noida-route-stops-v1",
        )
        if token_error:
            return Response({"success": False, "message": token_error, "code": "DRY_RUN_TOKEN_INVALID"}, status=409)

        road_routes = {}
        for key, group in groups.items():
            stop_rows = {
                stop.pk: stop for stop in Stop.objects.filter(
                    pk__in=[item["global_stop_id"] for item in group["stops"]],
                    city=city, is_global=True,
                )
            }
            if len(stop_rows) != len(group["stops"]):
                return Response({
                    "success": False,
                    "message": "A matched global stop changed after Dry Run. Run the validation again before applying.",
                    "code": "GLOBAL_STOP_CHANGED",
                }, status=409)
            coordinates = [
                (stop_rows[item["global_stop_id"]].location.x, stop_rows[item["global_stop_id"]].location.y)
                for item in group["stops"]
            ]
            road_route = OSRMService.get_road_path_through(*coordinates)
            if not road_route:
                return Response({
                    "success": False,
                    "message": f"OSRM could not produce valid road geometry through every stop in {group['route_name']}.",
                    "code": "ROUTE_GEOMETRY_UNAVAILABLE",
                }, status=502)
            road_routes[key] = road_route

        try:
            with transaction.atomic():
                for key, group in groups.items():
                    _, source_route_id, source_direction_id = key
                    route = Route.objects.select_for_update().filter(
                        city=city,
                        source_route_id=source_route_id,
                        source_direction_id=source_direction_id,
                    ).first()
                    if route is None:
                        legacy_matches = Route.objects.select_for_update().filter(
                            city=city,
                            route_code__iexact=group["route_number"],
                            name__iexact=group["route_name"],
                            source_route_id="",
                            source_direction_id="",
                        )
                        if legacy_matches.count() == 1:
                            route = legacy_matches.first()

                    is_new = route is None
                    if route is None:
                        route = Route(city=city)

                    stops = group["stops"]
                    route.name = group["route_name"]
                    route.route_code = group["route_number"][:50]
                    route.source_route_id = source_route_id
                    route.source_direction_id = source_direction_id
                    route.route_number = group["route_number"]
                    route.direction_name = source_direction_id
                    route.start_name = stops[0]["name"]
                    route.end_name = stops[-1]["name"]
                    route.path = LineString(
                        road_routes[key]["geometry"]["coordinates"], srid=4326,
                    )
                    route.total_distance_meters = float(road_routes[key]["distance"] or 0)
                    # Choosing Import in the authenticated Admin panel is the
                    # explicit action that makes these validated rows searchable.
                    route.is_public = True
                    route.save()
                    report["report"]["routes_imported"] += 1
                    report["report"]["routes_created"] += int(is_new)

                    RouteStopAssociation.objects.filter(route=route).delete()
                    RouteStopAssociation.objects.bulk_create([
                        RouteStopAssociation(
                            route=route, stop_id=item["global_stop_id"],
                            order=item["sequence"],
                        ) for item in stops
                    ])
                    report["report"]["stops_imported"] += len(stops)

            report["stage"] = "applied"
            report["applied"] = True
            report["can_apply"] = False
            report["message"] = (
                f"Imported {report['report']['routes_valid']} searchable routes and "
                f"{report['report']['valid_rows']} global-stop memberships into {city.name}."
            )
        except Exception:
            logger.exception("Noida route-stop import failed; transaction rolled back")
            return Response({
                "success": False,
                "message": "Import failed; all database changes were rolled back.",
                "code": "NOIDA_IMPORT_ROLLED_BACK",
            }, status=500)

        return Response({"success": True, "message": report["message"], "data": report}, status=201)

    def post(self, request):
        upload = request.FILES.get("file")
        if not upload:
            return Response({"success": False, "message": "Choose a CSV, XLSX, XLSM, or JSON route/stop file."}, status=400)
        if upload.size > self.MAX_UPLOAD_BYTES:
            return Response({"success": False, "message": "Upload must be 10 MB or smaller."}, status=413)
        mode = request.data.get("mode", "validate")
        if mode not in ("validate", "apply"):
            return Response({"success": False, "message": "mode must be validate or apply."}, status=400)

        extension = upload.name.rsplit(".", 1)[-1].lower() if "." in upload.name else ""
        if extension not in ("csv", "xlsx", "xlsm", "json"):
            return Response({"success": False, "message": "Supported corpus files are CSV, XLSX, XLSM, or JSON."}, status=400)

        try:
            raw = upload.read()
            records = decode_tabular_upload(raw, extension)
        except (UnicodeDecodeError, json.JSONDecodeError, ValueError, OSError) as exc:
            return Response({"success": False, "message": str(exc) or "Could not parse the uploaded file."}, status=400)
        except Exception:
            logger.exception("Could not parse admin onboarding upload")
            return Response({"success": False, "message": "Could not parse the upload. Check its file format and contents."}, status=400)

        if not records:
            return Response({"success": False, "message": "The uploaded file contains no data rows."}, status=400)

        normalized_headers = {
            str(key or "").strip().lower().replace(" ", "_")
            for key in records[0]
        }
        master_headers = {"city_id", "direction_id", "stop_id", "route_geometry_id"}
        is_master_v1 = "schema_version" in normalized_headers
        looks_like_master = bool(normalized_headers.intersection(master_headers))
        if request.data.get("import_format") == "noida_route_stops" and not is_master_v1:
            return self._post_noida_route_stops(request, upload, raw, records, mode)
        if looks_like_master and not is_master_v1:
            return Response({
                "success": False,
                "message": "This looks like a multi-city master CSV but is missing schema_version. Add schema_version=1 and use the complete version 1 column set.",
                "code": "MASTER_SCHEMA_VERSION_REQUIRED",
            }, status=400)
        if is_master_v1:
            return self._post_master_v1(
                request, upload, raw, records, request.FILES.get("geometry_file"), mode,
            )

        try:
            route_groups, global_stops, invalid, warnings = normalize_import_records(records)
        except (ValueError, TypeError) as exc:
            return Response({"success": False, "message": str(exc)}, status=400)

        geometry_upload = request.FILES.get("geometry_file")
        route_geometries = {}
        geometry_errors = []
        geometry_raw = b""
        if geometry_upload:
            if geometry_upload.size > self.MAX_UPLOAD_BYTES:
                return Response({"success": False, "message": "Geometry upload must be 10 MB or smaller."}, status=413)
            if not geometry_upload.name.lower().endswith((".geojson", ".json")):
                return Response({"success": False, "message": "Route geometry must be a GeoJSON FeatureCollection."}, status=400)
            try:
                geometry_raw = geometry_upload.read()
                route_geometries, geometry_errors = parse_geojson_routes(geometry_raw)
            except (UnicodeDecodeError, json.JSONDecodeError, ValueError) as exc:
                return Response({"success": False, "message": str(exc) or "Could not parse the GeoJSON geometry file."}, status=400)
            except Exception:
                logger.exception("Could not parse admin route geometry upload")
                return Response({"success": False, "message": "Could not parse the GeoJSON geometry file."}, status=400)

        matched_routes = {}
        missing_geometry = []
        for route_key, points in route_groups.items():
            route_name, route_code = route_key
            geometry = route_geometries.get(("code", route_code.casefold())) if route_code else None
            geometry = geometry or route_geometries.get(("name", route_name.casefold()))
            if geometry:
                matched_routes[route_key] = (points, geometry)
            else:
                missing_geometry.append({"route_name": route_name, "route_code": route_code,
                                         "stop_count": len(points),
                                         "reason": "matching source LineString geometry is required"})
        if missing_geometry:
            warnings.append("Some route stop groups have no matching source geometry and will not be imported as routes.")
            if mode == "apply":
                return Response({
                    "success": False,
                    "message": "Route import requires matching source GeoJSON geometry for every route direction.",
                    "data": {"routes_missing_geometry": missing_geometry[:100], "errors": invalid[:100]},
                }, status=422)

        valid_count = len(global_stops) + sum(len(points) for points, _ in matched_routes.values())
        if valid_count == 0:
            message = "No importable rows found. Route groups need at least two valid ordered stops and matching GeoJSON LineString geometry."
            if missing_geometry and mode == "apply":
                return Response({"success": False, "message": message,
                                 "data": {"routes_missing_geometry": missing_geometry[:100], "errors": invalid[:100]}}, status=422)
            if not missing_geometry:
                return Response({"success": False,
                    "message": "No valid stop rows found. Check the documented CSV columns and route geometry.",
                    "data": {"rows": len(records), "errors": invalid[:100]}}, status=400)

        city_slug = str(request.data.get("city_slug") or "").strip()
        city_name = str(request.data.get("city_name") or "").strip()
        city = (City.objects.filter(slug__iexact=city_slug).first() or
                City.objects.filter(name__iexact=city_slug).first()) if city_slug else None
        if city is None and city_name:
            city = City.objects.filter(name__iexact=city_name).first()
        if city is None and not city_name:
            return Response({"success": False, "message": "Choose an existing city or enter a new city name."}, status=400)

        import_points = list(global_stops)
        membership_rows = 0
        for points, _ in matched_routes.values():
            membership_rows += len(points)
        unique_names = {item["name"].casefold() for item in import_points}
        already_present = 0
        if city:
            for item in import_points:
                point = Point(item["lng"], item["lat"], srid=4326)
                if Stop.objects.filter(city=city, is_global=True, name__iexact=item["name"], location__distance_lte=(point, D(m=1))).exists():
                    already_present += 1
        imported_global_keys = {
            (item["name"].casefold(), round(item["lat"], 6), round(item["lng"], 6))
            for item in global_stops
        }
        unmatched_memberships = []
        for (route_name, route_code), (points, _geometry) in matched_routes.items():
            for point_data in points:
                imported_key = (point_data["name"].casefold(), round(point_data["lat"], 6), round(point_data["lng"], 6))
                matched = _match_imported_global_stop(city, point_data) if city else None
                if matched is None and imported_key not in imported_global_keys:
                    unmatched_memberships.append({
                        "row": route_name,
                        "reason": f"Route stop {point_data['name']!r} needs one exact existing or imported global-stop match before it can be associated.",
                    })
        invalid.extend(unmatched_memberships)
        if request.data.get("fare_per_km") not in (None, "") and city is not None:
            warnings.append("Fare per km is only applied when creating a new city; existing city pricing is unchanged by this import.")
        warnings.extend(f"GeoJSON feature {item['row']}: {item['reason']}" for item in geometry_errors[:100])
        digest = hashlib.sha256(raw + geometry_raw).hexdigest()
        report = {
            "stage": "validated" if mode == "validate" else "applying", "applied": False,
            "dataset_kind": "route-corpus" if route_groups else "stops",
            "source": {"file": upload.name, "file_sha256": digest,
                       "geometry_file": geometry_upload.name if geometry_upload else None},
            "city": {"name": city.name if city else city_name, "slug": city.slug if city else slugify(city_name)},
            "report": {"rows": len(records), "routes": len(matched_routes),
                "routes_missing_geometry": len(missing_geometry),
                "stop_instances": len(global_stops), "route_stop_memberships": membership_rows,
                "global_stop_memberships_unmatched": len(unmatched_memberships),
                "unique_names": len(unique_names),
                "serviceable": 0, "already_present": already_present,
                "would_create": max(0, len(import_points) - already_present), "created": 0, "updated": 0,
                "conflicts": invalid[:100], "unresolved": len(invalid) + sum(item["stop_count"] for item in missing_geometry),
                "status_breakdown": {"provisional": len(global_stops), "unresolved": len(invalid) + sum(item["stop_count"] for item in missing_geometry)}},
            "invalid_count": len(invalid), "invalid": invalid[:100], "warnings": warnings,
            "errors": invalid[:100],
            "routes_missing_geometry": missing_geometry[:100],
            "created": 0, "duplicates": 0, "routes_created": 0,
        }
        city_token_key = city.pk if city else f"new:{slugify(city_name)}"
        report["can_apply"] = valid_count > 0 and not unmatched_memberships
        if mode == "validate":
            if report["can_apply"]:
                report["apply_token"] = _issue_import_token(
                    request, city_token_key, digest, "legacy",
                )
            return Response({"success": True, "message": "Dry run completed; no database changes were made.", "data": report}, status=200)

        token_error = _verify_import_token(
            request,
            request.data.get("apply_token"),
            city_token_key,
            digest,
            "legacy",
        )
        if token_error:
            return Response({"success": False, "message": token_error, "code": "DRY_RUN_TOKEN_INVALID"}, status=409)

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
                for item in global_stops:
                    point = Point(item["lng"], item["lat"], srid=4326)
                    existing = _match_imported_global_stop(city, item)
                    if existing:
                        report["duplicates"] += 1
                        continue
                    Stop.objects.create(
                        city=city, route=None, is_global=True, name=item["name"], location=point,
                        coordinate_status="provisional",
                        serviceability_reason="Imported named-stop candidate; route membership not supplied.",
                    )
                    report["created"] += 1
                for (route_name, route_code), (points, geometry) in matched_routes.items():
                    route = (Route.objects.filter(city=city, route_code__iexact=route_code).first() if route_code else None)
                    if route is None:
                        route = Route.objects.filter(city=city, name__iexact=route_name).first()
                    is_new = route is None
                    if route is None:
                        route = Route(city=city, name=route_name, route_code=route_code)
                    route.name = route_name
                    route.route_code = route_code
                    route.path = LineString(geometry, srid=4326)
                    route.start_name = points[0]["name"]
                    route.end_name = points[-1]["name"]
                    route.is_public = False
                    route.save()
                    report["routes_created"] += int(is_new)

                    memberships = []
                    for point_data in points:
                        stop = _match_imported_global_stop(city, point_data)
                        if stop is None:
                            raise ValueError(f"Route stop {point_data['name']!r} no longer matches a global stop; rerun Dry Run.")
                        memberships.append(RouteStopAssociation(
                            route=route, stop=stop, order=point_data["sequence"],
                        ))
                    route.route_stop_associations.all().delete()
                    RouteStopAssociation.objects.bulk_create(memberships)
                    report["report"]["global_stop_memberships_created"] = report["report"].get("global_stop_memberships_created", 0) + len(memberships)
                report["stage"] = "applied"
                report["applied"] = True
                report["report"]["created"] = report["created"]
                report["report"]["already_present"] = report["duplicates"]
                report["report"]["would_create"] = report["created"]
                report["message"] = (f"Imported {report['created']} global stop candidates and "
                    f"{report['routes_created']} private routes with {report['report'].get('global_stop_memberships_created', 0)} ordered global-stop memberships into {city.name}; skipped {report['duplicates']} duplicates.")
        except ValueError as exc:
            logger.info("Admin onboarding route import rejected: %s", exc)
            return Response({"success": False, "message": str(exc), "data": report}, status=422)
        except Exception:
            logger.exception("Admin onboarding import failed")
            return Response({"success": False, "message": "Import failed; the database transaction was rolled back. Review the server error log for the request."}, status=500)
        return Response({"success": True, "message": report["message"], "data": report}, status=201)


class RouteByBusNumberAPIView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, bus_number):
        route = Route.objects.filter(route_code__iexact=bus_number).select_related("city").prefetch_related("stops").first()
        if not route:
            return Response({"success": False, "message": "Route not found for this bus/route number."}, status=404)
        return Response({"success": True, "data": RouteDetailSerializer(route).data}, status=200)
