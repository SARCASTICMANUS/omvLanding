import logging
from uuid import UUID
import json
from typing import Dict, Any, List
from math import radians, sin, cos, sqrt, atan2
from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework import serializers, status
from collections import defaultdict
from django.db.models import Q
from django.db import transaction
from django.contrib.gis.db.models.functions import Distance
from django.contrib.gis.geos import Point, LineString
from django.contrib.gis.measure import D

from common.constants import (
    VEHICLE_AUTO,
    ROLE_BIKE_DRIVER,
    ROLE_AUTO_DRIVER,
    PASSENGER_STOP_RADIUS_M,
)
from accounts.permissions import IsAdmin
from common.responses import error_response, success_response
from transport.services import stop_import_service
from transport.api.serializers import (
    CitySerializer,
    AdminCitySerializer,
    NearbyStopSerializer,
    RouteListSerializer,
    RouteDetailSerializer,
    StopSerializer,
    TripScheduleSerializer,
    StopTimeSerializer,
    DriverRouteSerializer,
    RouteSearchInputSerializer,
    RouteSearchResponseSerializer,
    DriverRouteSearchResponseSerializer,
)
from transport.models import City, Stop, Route, TripSchedule, StopTime
from tracking.services.eta_service import ETAService
from tracking.services.geo_service import GeoService
from transport.selectors.city_selector import CitySelector
from transport.selectors.route_selector import RouteSelector
from transport.selectors.driver_route_selector import DriverRouteSelector
from transport.services.route_service import RouteService
from transport.services.osrm_service import OSRMService
from transport.services.route_search_service import RouteSearchService

logger = logging.getLogger(__name__)

class CityViewSet(viewsets.ReadOnlyModelViewSet):
    """
    Public catalogue of cities.

    Read-only for authenticated users. Writes go through
    /transport/admin/cities/ (AdminCityViewSet, IsAdmin).
    """
    queryset = City.objects.all()
    serializer_class = CitySerializer
    permission_classes = [IsAuthenticated]
    http_method_names = ["get", "head", "options"]

    def get_queryset(self):
        return CitySelector.list_cities()

class RouteViewSet(viewsets.ReadOnlyModelViewSet):
    """
    Public route catalogue.

    Read-only for authenticated users. This is the same queryset the admin
    editor reads from, so the admin UI keeps listing routes here; every write
    goes through /transport/admin/routes/ (AdminRouteViewSet, IsAdmin).
    """
    queryset = Route.objects.all()
    permission_classes = [IsAuthenticated]
    # "post" is here only so the admin-gated recalculate_distance action below
    # is reachable; it is NOT a blanket write allowance. ReadOnlyModelViewSet
    # contributes no create/update/destroy, so the router maps POST to nothing
    # except that action. If a write method is ever added to this class, the
    # router would expose it and get_permissions() would fall through to
    # IsAuthenticated — put writes on AdminRouteViewSet instead.
    http_method_names = ["get", "head", "options", "post"]

    def get_serializer_class(self):
        if self.action in ['list']:
            return RouteListSerializer
        return RouteDetailSerializer

    def get_queryset(self):
        if self.action == 'list':
            city_id = self.request.query_params.get("city_id")
            search = self.request.query_params.get("search")

            if search:
                return RouteSelector.search_routes(search)
            elif city_id:
                return RouteSelector.list_city_routes(city_id)
            else:
                return RouteSelector.list_routes()
        return (
            Route.objects
            .select_related("city")
            .prefetch_related(
                "stops",
                "schedules",
                "schedules__stop_times",
                "schedules__stop_times__stop",
            )
        )

    def get_permissions(self):
        """
        recalculate_distance is a POST that mutates the route, so it stays off
        the public read-only surface and is admin-gated.
        """
        if self.action == "recalculate_distance":
            return [IsAdmin()]
        return super().get_permissions()

    @action(detail=True, methods=['post'])
    def recalculate_distance(self, request, pk=None):
        route = self.get_object()
        distance = RouteService.recalculate_route_distance(route.id)
        resp = Response({
            "success": True,
            "total_distance_meters": distance
        })
        return resp

class StopViewSet(viewsets.ReadOnlyModelViewSet):
    """
    Public stop catalogue.

    Read-only for authenticated users. Writes go through
    /transport/admin/stops/ (AdminStopViewSet, IsAdmin).
    """
    queryset = Stop.objects.all()
    serializer_class = StopSerializer
    permission_classes = [IsAuthenticated]
    http_method_names = ["get", "head", "options"]

class TripScheduleViewSet(viewsets.ReadOnlyModelViewSet):
    """
    Public schedule catalogue.

    Read-only for authenticated users. Writes go through
    /transport/admin/schedules/ (AdminTripScheduleViewSet, IsAdmin).
    """
    queryset = TripSchedule.objects.all()
    serializer_class = TripScheduleSerializer
    permission_classes = [IsAuthenticated]
    http_method_names = ["get", "head", "options"]

class StopTimeViewSet(viewsets.ReadOnlyModelViewSet):
    """
    Public stop-time catalogue.

    Read-only for authenticated users. Writes go through
    /transport/admin/stop-times/ (AdminStopTimeViewSet, IsAdmin).
    """
    queryset = StopTime.objects.all()
    serializer_class = StopTimeSerializer
    permission_classes = [IsAuthenticated]
    http_method_names = ["get", "head", "options"]

class RouteScheduleAPIView(APIView):
    """
    GET /api/routes/{id}/schedule
    Returns scheduled times for all stops on a route.
    """
    permission_classes = [AllowAny]

    def get(self, request, route_id):
        try:
            schedules = TripSchedule.objects.filter(route_id=route_id, is_active=True).prefetch_related('stop_times', 'stop_times__stop')
            
            data = []
            for schedule in schedules:
                data.append({
                    "schedule_id": str(schedule.id),
                    "label": schedule.label,
                    "start_time": schedule.scheduled_start_time,
                    "stops": StopTimeSerializer(schedule.stop_times.all(), many=True).data
                })

            resp = Response({
                "success": True,
                "message": "Route schedule fetched",
                "data": data
            })
            return resp
        except Exception as e:
            logger.exception(f"[RouteSchedule] Failed for route {route_id}")
            return Response({"success": False, "message": str(e)}, status=status.HTTP_404_NOT_FOUND)

class StopETAAPIView(APIView):
    """
    GET /api/stops/{id}/eta
    Returns real-time ETA for the next vehicles at a stop.
    """
    permission_classes = [AllowAny]

    def get(self, request, stop_id):
        try:
            stop = Stop.objects.get(id=stop_id)
            etas = ETAService.get_stop_etas(stop_id)
            
            resp = Response({
                "success": True,
                "message": "Stop ETAs fetched",
                "data": etas
            })
            return resp
        except Stop.DoesNotExist:
            logger.warning(f"[StopETA] Stop {stop_id} not found")
            return Response({"success": False, "message": "Stop not found"}, status=status.HTTP_404_NOT_FOUND)

class RouteGeometryAPIView(APIView):
    """
    GET /api/transport/routes/{id}/geometry
    Returns route path as GeoJSON and stop markers.
    """
    permission_classes = [AllowAny]

    def get(self, request, route_id):
        try:
            route = Route.objects.get(id=route_id)
            stops = route.stops.all().order_by("order")
            
            path_geojson = json.loads(route.path.geojson)
            
            stop_markers = []
            for stop in stops:
                stop_markers.append({
                    "id": str(stop.id),
                    "name": stop.name,
                    "order": stop.order,
                    "location": json.loads(stop.location.geojson)
                })
                
            resp = Response({
                "success": True,
                "data": {
                    "route_id": str(route.id),
                    "name": route.name,
                    "path": path_geojson,
                    "stops": stop_markers
                }
            })
            return resp
        except Route.DoesNotExist:
            logger.warning(f"[RouteGeometry] Route {route_id} not found")
            return Response({"success": False, "message": "Route not found"}, status=status.HTTP_404_NOT_FOUND)

class DynamicRouteUpdateAPIView(APIView):
    """
    PATCH /api/routes/{id}
    Allows operators to modify route visibility or status.
    """
    permission_classes = [IsAuthenticated]

    def patch(self, request, route_id):
        try:
            route = Route.objects.get(id=route_id)
            if 'is_public' in request.data:
                route.is_public = request.data['is_public']
            
            route.save()
            resp = Response({
                "success": True,
                "message": "Route updated",
                "data": RouteDetailSerializer(route).data
            })
            return resp
        except Route.DoesNotExist:
            logger.warning(f"[DynamicRouteUpdate] Route {route_id} not found")
            return Response({"success": False, "message": "Route not found"}, status=status.HTTP_404_NOT_FOUND)

class CityListAPIView(APIView):
    permission_classes = [AllowAny]

    def get(self, request):
        cities = CitySelector.list_cities()
        serializer = CitySerializer(cities, many=True)
        resp = Response(serializer.data, status=status.HTTP_200_OK)
        return resp

class CityDetailAPIView(APIView):
    permission_classes = [AllowAny]

    def get(self, request, city_id):
        city = CitySelector.get_city(city_id)
        serializer = CitySerializer(city)
        resp = Response(serializer.data, status=status.HTTP_200_OK)
        return resp

class RouteListAPIView(APIView):
    permission_classes = [AllowAny]

    def get(self, request):
        city_id = request.query_params.get("city_id")
        search = request.query_params.get("search")

        if search:
            routes = RouteSelector.search_routes(search)
        elif city_id:
            routes = RouteSelector.list_city_routes(city_id)
        else:
            routes = RouteSelector.list_routes()

        serializer = RouteListSerializer(routes, many=True)
        resp = Response(serializer.data, status=status.HTTP_200_OK)
        return resp

class RouteDetailAPIView(APIView):
    permission_classes = [AllowAny]

    def get(self, request, route_id):
        route = RouteSelector.get_route(route_id)
        serializer = RouteDetailSerializer(route)
        resp = Response(serializer.data, status=status.HTTP_200_OK)
        return resp

class RouteByRouteCodeAPIView(APIView):
    permission_classes = [AllowAny]

    def get(self, request, route_code):
        route = RouteSelector.get_route_by_route_code(route_code)
        serializer = RouteDetailSerializer(route)
        resp = Response(serializer.data, status=status.HTTP_200_OK)
        return resp

class NearbyStopListAPIView(APIView):
    permission_classes = [AllowAny]

    def get(self, request):
        serializer = NearbyStopQuerySerializer(data=request.query_params)
        serializer.is_valid(raise_exception=True)

        lat = serializer.validated_data["lat"]
        lng = serializer.validated_data["lng"]
        radius = serializer.validated_data["radius"]

        point = Point(lng, lat, srid=4326)

        stops = (
            Stop.objects
            .select_related("route")
            .filter(location__distance_lte=(point, D(m=radius)))
            .annotate(distance=Distance("location", point))
            .order_by("distance")[:50]
        )

        for stop in stops:
            stop.distance_meters = stop.distance.m if stop.distance else None

        resp = Response(NearbyStopSerializer(stops, many=True).data, status=status.HTTP_200_OK)
        return resp


class GlobalStopQuerySerializer(serializers.Serializer):
    """
    Query for admin-created global stops near a point.

    The radius defaults to the passenger walking radius, because the question
    this answers is "can I walk to a stop from here?".
    """

    lat = serializers.FloatField()
    lng = serializers.FloatField()
    radius = serializers.IntegerField(
        required=False,
        default=PASSENGER_STOP_RADIUS_M,
        min_value=1,
        max_value=10000,
    )

    def validate_lat(self, value):
        if value < -90 or value > 90:
            raise serializers.ValidationError("Latitude must be between -90 and 90.")
        return value

    def validate_lng(self, value):
        if value < -180 or value > 180:
            raise serializers.ValidationError("Longitude must be between -180 and 180.")
        return value


class GlobalStopSerializer(serializers.ModelSerializer):
    """A global stop, as the passenger app needs it."""

    distance_meters = serializers.SerializerMethodField()

    class Meta:
        model = Stop
        fields = [
            "id",
            "name",
            "location",
            "nearby_landmark",
            "city",
            "distance_meters",
        ]

    def get_distance_meters(self, obj):
        return getattr(obj, "distance_meters", None)


class GlobalStopListAPIView(APIView):
    """
    GET /api/transport/global-stops/nearby/?lat=&lng=&radius=
    Admin-created global stops near a point.

    These are the stops a passenger can raise a hand at, and the ones a driver's
    journey is matched against. Route stops are excluded: they are ordered
    positions on a fixed line and mean nothing without their route.
    """

    permission_classes = [AllowAny]

    def get(self, request):
        serializer = GlobalStopQuerySerializer(data=request.query_params)
        serializer.is_valid(raise_exception=True)

        lat = serializer.validated_data["lat"]
        lng = serializer.validated_data["lng"]
        radius = serializer.validated_data["radius"]

        point = Point(lng, lat, srid=4326)

        stops = (
            Stop.objects
            .filter(is_global=True, location__distance_lte=(point, D(m=radius)))
            .annotate(distance=Distance("location", point))
            .order_by("distance")[:50]
        )

        for stop in stops:
            stop.distance_meters = stop.distance.m if stop.distance else None

        return Response(
            {
                "success": True,
                "data": GlobalStopSerializer(stops, many=True).data,
            },
            status=status.HTTP_200_OK,
        )

class NearbyStopQuerySerializer(serializers.Serializer):
    lat = serializers.FloatField()
    lng = serializers.FloatField()
    radius = serializers.IntegerField(required=False, default=1500, min_value=1, max_value=10000)

    def validate_lat(self, value):
        if value < -90 or value > 90:
            raise serializers.ValidationError("Latitude must be between -90 and 90.")
        return value

    def validate_lng(self, value):
        if value < -180 or value > 180:
            raise serializers.ValidationError("Longitude must be between -180 and 180.")
        return value

class RouteSearchByLocationSerializer(serializers.Serializer):
    origin_lat = serializers.FloatField()
    origin_lng = serializers.FloatField()
    dest_lat = serializers.FloatField()
    dest_lng = serializers.FloatField()
    radius = serializers.IntegerField(required=False, default=5000, min_value=100, max_value=10000)

    def validate_origin_lat(self, value: float) -> float:
        if not (-90 <= value <= 90):
            raise serializers.ValidationError("origin_lat must be between -90 and 90.")
        return value

    def validate_dest_lat(self, value: float) -> float:
        if not (-90 <= value <= 90):
            raise serializers.ValidationError("dest_lat must be between -90 and 90.")
        return value

    def validate_origin_lng(self, value: float) -> float:
        if not (-180 <= value <= 180):
            raise serializers.ValidationError("origin_lng must be between -180 and 180.")
        return value

    def validate_dest_lng(self, value: float) -> float:
        if not (-180 <= value <= 180):
            raise serializers.ValidationError("dest_lng must be between -180 and 180.")
        return value

class RouteSearchByLocationAPIView(APIView):
    """
    GET /api/transport/routes/search-by-location/
    Finds routes whose stops lie near both the origin and destination.

    Query params: origin_lat, origin_lng, dest_lat, dest_lng, radius, role.
    `role` (optional, `passenger` by default) selects the response payload:
      - passenger (default): full payload including walk aggregates,
        first/last-mile walk, nearest-road metadata, and stops.
      - driver: trimmed payload dropping passenger-only walk aggregates and
        nearest-road metadata while retaining first/last-mile walk and stops.
    Both shapes share the same envelope: { success, message, data }.
    """
    permission_classes = [AllowAny]

    def get(self, request):
        input_serializer = RouteSearchInputSerializer(data=request.query_params)
        input_serializer.is_valid(raise_exception=True)

        validated_data = dict(input_serializer.validated_data)
        role = validated_data.pop("role", "passenger")

        results = RouteSearchService.search_routes(**validated_data)

        serializer_class = (
            DriverRouteSearchResponseSerializer
            if role == "driver"
            else RouteSearchResponseSerializer
        )
        output_serializer = serializer_class(results, many=True)
        return Response({
            "success": True,
            "message": f"Found {len(results)} routes",
            "data": output_serializer.data,
        })


class RoutePreviewInputSerializer(serializers.Serializer):
    lat = serializers.FloatField()
    lon = serializers.FloatField()
    name = serializers.CharField(required=False, default="")

class DriverRouteListAPIView(APIView):
    """
    GET /api/transport/driver/routes/
    Returns all public routes with stops in driver-friendly format.
    """
    permission_classes = [AllowAny]

    def get(self, request):
        routes = DriverRouteSelector.list_driver_routes()
        serializer = DriverRouteSerializer(routes, many=True)
        resp = Response({
            "success": True,
            "data": serializer.data,
        })
        return resp

class RoutePreviewAPIView(APIView):
    """
    POST /api/transport/routes/preview/
    Returns route path(s) from OSRM for given start, end, and stops.
    """
    permission_classes = [AllowAny]

    def post(self, request):
        try:
            start_data = request.data.get("start")
            end_data = request.data.get("end")
            stops_data = request.data.get("stops", [])

            if not start_data or not end_data:
                return Response(
                    {"success": False, "message": "Start and end are required"},
                    status=status.HTTP_400_BAD_REQUEST,
                )

            # Build waypoints: start → stops → end
            waypoints = [(start_data["lon"], start_data["lat"])]
            for stop in stops_data:
                waypoints.append((stop["lon"], stop["lat"]))
            waypoints.append((end_data["lon"], end_data["lat"]))

            result = OSRMService.route(*waypoints)
            routes = result.get("routes", []) if result else []

            previews = []
            for i, route in enumerate(routes):
                coords = route.get("geometry", {}).get("coordinates", [])
                previews.append({
                    "path": coords,
                    "distance": route.get("distance", 0),
                    "duration": route.get("duration", 0),
                })

            logger.info(f"[RoutePreview] Generated {len(previews)} route previews for {len(waypoints)} waypoints")
            resp = Response(previews, status=status.HTTP_200_OK)
            return resp

        except Exception as e:
            logger.exception("[RoutePreview] Route preview failed")
            return Response(
                {"success": False, "message": str(e)},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )

class PassengersAlongRouteAPIView(APIView):
    """
    GET /api/transport/routes/<route_id>/nearby-passengers/

    Returns passengers whose current location is within `radius` meters
    of any stop on the given route, along with which stop they're near.
    """
    permission_classes = [AllowAny]

    def get(self, request, route_id):
        from transport.models import Route
        from accounts.models import PublicPassengerProfile
        from django.contrib.gis.geos import MultiPoint
        from tracking.services.geo_service import GeoService
        from django.contrib.gis.measure import D
        from django.utils import timezone
        from datetime import timedelta

        try:
            route = Route.objects.get(id=route_id)
        except Route.DoesNotExist:
            logger.warning(f"[PassengersAlongRoute] Route {route_id} not found")
            return Response(
                {"success": False, "message": "Route not found"},
                status=status.HTTP_404_NOT_FOUND,
            )

        radius = int(request.query_params.get("radius", 2000))
        max_inactive_min = int(request.query_params.get("max_inactive_min", 30))
        cutoff = timezone.now() - timedelta(minutes=max_inactive_min)

        stops = list(route.stops.all().order_by("order"))
        if not stops:
            return Response({"success": True, "data": []})

        # Build a bounding polygon covering all stops within radius
        stop_points = [stop.location for stop in stops]
        coverage = MultiPoint(stop_points)
        bbox = coverage.buffer(radius / 111000.0)

        # Pre-filter profiles: must have location, be active, and be within radius of any stop
        profiles = PublicPassengerProfile.objects.filter(
            current_location__isnull=False,
            last_active_at__gte=cutoff,
            current_location__within=bbox,
        ).select_related("user").exclude(
            user__role__in=[ROLE_BIKE_DRIVER, ROLE_AUTO_DRIVER],
        )

        results = []
        for profile in profiles:
            nearest_stop = None
            nearest_dist = float("inf")
            p_lat, p_lng = profile.current_location.y, profile.current_location.x
            for stop in stops:
                d = GeoService.haversine_m(
                    p_lat, p_lng, stop.location.y, stop.location.x
                )
                if d < nearest_dist:
                    nearest_dist = d
                    nearest_stop = stop

            if nearest_dist > radius:
                continue

            saved = profile.saved_routes.filter(id=route.id).first()

            results.append({
                "id": str(profile.user.id),
                "name": profile.display_name or profile.user.full_name or profile.user.email.split("@")[0],
                "avatar": (profile.display_name or "P")[0].upper(),
                "lat": profile.current_location.y,
                "lon": profile.current_location.x,
                "near_stop": nearest_stop.name,
                "near_stop_order": nearest_stop.order,
                "distance_to_stop_m": round(nearest_dist),
                "rating": getattr(profile.user, "avg_rating", None),
                "last_active": profile.last_active_at.isoformat() if profile.last_active_at else None,
                "wants_route": bool(saved),
            })

        results.sort(key=lambda p: p["distance_to_stop_m"])

        logger.info(f"[PassengersAlongRoute] Found {len(results)} passengers near route {route_id} (radius={radius}m)")
        resp = Response({
            "success": True,
            "data": results,
            "meta": {
                "route_id": str(route.id),
                "route_name": route.name,
                "stops_count": len(stops),
                "radius_m": radius,
                "passengers_found": len(results),
            },
        })
        return resp


class RoadDistanceInputSerializer(serializers.Serializer):
    origin_lat = serializers.FloatField()
    origin_lng = serializers.FloatField()
    dest_lat = serializers.FloatField()
    dest_lng = serializers.FloatField()


class RoadDistanceAPIView(APIView):
    """
    POST /api/transport/road-distance/
    Returns road distance (meters) and duration (seconds) between two coordinates via OSRM.

    Request:
    {
        "origin_lat": 26.8467,
        "origin_lng": 80.9462,
        "dest_lat": 26.8567,
        "dest_lng": 80.9562
    }

    Response:
    {
        "success": true,
        "data": {
            "distance_m": 1234.5,
            "distance_km": 1.23,
            "duration_s": 180,
            "duration_min": 3
        }
    }
    """
    permission_classes = [AllowAny]

    def post(self, request):
        serializer = RoadDistanceInputSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        origin = (serializer.validated_data["origin_lng"], serializer.validated_data["origin_lat"])
        dest = (serializer.validated_data["dest_lng"], serializer.validated_data["dest_lat"])

        distance_m = OSRMService.get_road_distance_m(origin, dest)
        duration_s = OSRMService.get_road_duration_s(origin, dest)

        if distance_m is None or duration_s is None:
            return Response(
                {"success": False, "message": "OSRM routing failed", "data": None},
                status=status.HTTP_502_BAD_GATEWAY,
            )

        return Response({
            "success": True,
            "data": {
                "distance_m": distance_m,
                "distance_km": round(distance_m / 1000, 2),
                "duration_s": duration_s,
                "duration_min": max(1, round(duration_s / 60)),
            },
        })


class WalkingPathInputSerializer(serializers.Serializer):
    origin_lat = serializers.FloatField()
    origin_lng = serializers.FloatField()
    dest_lat = serializers.FloatField()
    dest_lng = serializers.FloatField()


class WalkingPathAPIView(APIView):
    """
    POST /api/transport/walking-path/
    Returns the road path (GeoJSON LineString) plus distance/duration between
    two coordinates via OSRM. Used to draw the walking route from the
    passenger's current location to the nearest stop.

    Request:
    {
        "origin_lat": 26.8467,
        "origin_lng": 80.9462,
        "dest_lat": 26.8567,
        "dest_lng": 80.9562
    }

    Response:
    {
        "success": true,
        "data": {
            "path": { "type": "LineString", "coordinates": [[lon, lat], ...] },
            "distance_m": 1234.5,
            "duration_s": 180
        }
    }
    """
    permission_classes = [AllowAny]

    def post(self, request):
        serializer = WalkingPathInputSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        origin = (serializer.validated_data["origin_lng"], serializer.validated_data["origin_lat"])
        dest = (serializer.validated_data["dest_lng"], serializer.validated_data["dest_lat"])

        result = OSRMService.get_road_path(origin, dest)
        if not result or not result.get("geometry"):
            return Response(
                {"success": False, "message": "OSRM routing failed", "data": None},
                status=status.HTTP_502_BAD_GATEWAY,
            )

        return Response({
            "success": True,
            "data": {
                "path": result["geometry"],
                "distance_m": result["distance"],
                "duration_s": result["duration"],
            },
        })


class GeocodeSearchAPIView(APIView):
    permission_classes = [AllowAny]

    def get(self, request):
        query = request.query_params.get("q", "").strip()
        if not query:
            return Response(
                {"success": False, "message": "Query parameter 'q' is required."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            limit = min(int(request.query_params.get("limit", 5)), 10)
        except (TypeError, ValueError):
            limit = 5

        country_codes = request.query_params.get("countrycodes", "in")

        from transport.services.geocoding_service import GeocodingService
        results = GeocodingService.search_cached(query, limit=limit, country_codes=country_codes)

        return Response(results, status=status.HTTP_200_OK)


class GeocodeDbSearchAPIView(APIView):
    """
    GET /api/transport/geocode/db/search/

    DB-only stop search combining Full-Text Search (FTS) and Trigram
    similarity (pg_trgm) over the Stops table.
    Query params: q (required), limit (optional, default 5, max 10), route_id (optional).
    """
    permission_classes = [AllowAny]

    def get(self, request):
        query = request.query_params.get("q", "").strip()
        if not query:
            return Response(
                {"success": False, "message": "Query parameter 'q' is required."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            limit = min(int(request.query_params.get("limit", 5)), 10)
        except (TypeError, ValueError):
            limit = 5

        from common.responses import success_response
        from transport.services.geocoding_service import GeocodingService

        results = GeocodingService.search_stops_fts_trgm(
            query,
            limit=limit,
            route_id=request.query_params.get("route_id"),
        )
        return success_response(
            results,
            message=f"Found {len(results)} stops",
            status_code=status.HTTP_200_OK,
        )


class GeocodeReverseAPIView(APIView):
    permission_classes = [AllowAny]

    def get(self, request):
        try:
            lat = float(request.query_params.get("lat", ""))
            lon = float(request.query_params.get("lon", ""))
        except (TypeError, ValueError):
            return Response(
                {"success": False, "message": "Parameters 'lat' and 'lon' are required."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        from transport.services.geocoding_service import GeocodingService
        result = GeocodingService.reverse(lat, lon)
        if not result:
            return Response(
                {"success": False, "message": "No results found."},
                status=status.HTTP_404_NOT_FOUND,
            )
        return Response(result, status=status.HTTP_200_OK)


# ---------------------------------------------------------------------------
# Admin views (merged from admin_views.py)
# ---------------------------------------------------------------------------

class AdminRouteViewSet(viewsets.ModelViewSet):
    queryset = Route.objects.all().select_related("city").prefetch_related(
        "stops", "schedules", "schedules__stop_times", "schedules__stop_times__stop"
    )
    permission_classes = [IsAdmin]

    def get_serializer_class(self):
        if self.action == "list":
            return RouteListSerializer
        return RouteDetailSerializer

    def list(self, request, *args, **kwargs):
        resp = super().list(request, *args, **kwargs)
        return Response({"success": True, "data": resp.data})

    def create(self, request, *args, **kwargs):
        resp = super().create(request, *args, **kwargs)
        return Response({"success": True, "data": resp.data}, status=status.HTTP_201_CREATED)

    def retrieve(self, request, *args, **kwargs):
        resp = super().retrieve(request, *args, **kwargs)
        return Response({"success": True, "data": resp.data})

    def update(self, request, *args, **kwargs):
        resp = super().update(request, *args, **kwargs)
        return Response({"success": True, "data": resp.data})

    def destroy(self, request, *args, **kwargs):
        super().destroy(request, *args, **kwargs)
        return Response({"success": True, "message": "Route deleted"}, status=status.HTTP_200_OK)


class AdminStopViewSet(viewsets.ModelViewSet):
    """Admin stop CRUD plus the filtered, paginated table contract used by Dynamic Routing."""
    queryset = Stop.objects.all().select_related("route", "city", "route__city")
    serializer_class = StopSerializer
    permission_classes = [IsAdmin]

    def get_queryset(self):
        queryset = super().get_queryset()
        scope = self.request.query_params.get("scope")
        if scope == "global":
            queryset = queryset.filter(is_global=True)
        elif scope == "route":
            queryset = queryset.filter(is_global=False)
        return queryset

    @staticmethod
    def _city_filter(queryset, city_value):
        if not city_value:
            return queryset
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
        return queryset.filter(city_query)

    @staticmethod
    def _coordinate_filter(queryset, status_value):
        if status_value in {"verified", "provisional", "conflict", "unresolved", "legacy_synthetic"}:
            queryset = queryset.filter(coordinate_status=status_value)
            if status_value == "verified":
                queryset = queryset.filter(location__isnull=False)
        return queryset

    @staticmethod
    def _table_row(stop):
        location = stop.location
        city = stop.city or (stop.route.city if stop.route_id else None)
        return {
            "id": str(stop.id), "name": stop.name,
            "city_slug": city.slug if city else "", "city_name": city.name if city else "",
            "lat": location.y if location else None, "lng": location.x if location else None,
            "coordinate_status": stop.coordinate_status,
            "serviceable": bool(location) and stop.coordinate_status == "verified",
            "serviceability_reason": stop.serviceability_reason or ("Coordinates available" if location and stop.coordinate_status == "verified" else "Needs coordinate review"),
            "is_routable": bool(stop.route_id and stop.route and stop.route.path),
            "aliases": stop.aliases or ([stop.name] if stop.name else []),
            "route": str(stop.route_id) if stop.route_id else None,
            "order": stop.order,
        }

    def list(self, request, *args, **kwargs):
        qs = self.filter_queryset(self.get_queryset())
        qs = self._city_filter(qs, request.query_params.get("city"))
        search = (request.query_params.get("q") or request.query_params.get("search") or "").strip()
        if search:
            qs = qs.filter(name__icontains=search)
        qs = self._coordinate_filter(qs, request.query_params.get("coordinate_status") or request.query_params.get("status"))
        serviceable = request.query_params.get("serviceable")
        if serviceable == "1":
            qs = qs.filter(location__isnull=False, coordinate_status="verified")
        elif serviceable == "0":
            qs = qs.exclude(location__isnull=False, coordinate_status="verified")
        try:
            limit = min(max(int(request.query_params.get("limit", 25)), 1), 100)
            offset = max(int(request.query_params.get("offset", 0)), 0)
        except (TypeError, ValueError):
            return Response({"success": False, "message": "limit and offset must be valid non-negative integers."}, status=400)
        count = qs.count()
        rows = [self._table_row(stop) for stop in qs.order_by("name", "id")[offset:offset + limit]]
        return Response({"success": True, "count": count, "total": count, "limit": limit,
                         "offset": offset, "results": rows, "data": rows}, status=200)

    def create(self, request, *args, **kwargs):
        resp = super().create(request, *args, **kwargs)
        return Response({"success": True, "data": resp.data}, status=status.HTTP_201_CREATED)

    def retrieve(self, request, *args, **kwargs):
        resp = super().retrieve(request, *args, **kwargs)
        return Response({"success": True, "data": resp.data})

    def update(self, request, *args, **kwargs):
        resp = super().update(request, *args, **kwargs)
        return Response({"success": True, "data": resp.data})

    def destroy(self, request, *args, **kwargs):
        super().destroy(request, *args, **kwargs)
        return Response({"success": True, "message": "Stop deleted"}, status=status.HTTP_200_OK)


class AdminTripScheduleViewSet(viewsets.ModelViewSet):
    """
    Guarded replacement for TripScheduleViewSet's writes.

    The public TripScheduleViewSet is read-only, so schedule editing has to
    live somewhere; this is that somewhere.
    """
    queryset = TripSchedule.objects.all().select_related("route")
    serializer_class = TripScheduleSerializer
    permission_classes = [IsAdmin]

    def list(self, request, *args, **kwargs):
        resp = super().list(request, *args, **kwargs)
        return Response({"success": True, "data": resp.data})

    def create(self, request, *args, **kwargs):
        resp = super().create(request, *args, **kwargs)
        return Response({"success": True, "data": resp.data}, status=status.HTTP_201_CREATED)

    def retrieve(self, request, *args, **kwargs):
        resp = super().retrieve(request, *args, **kwargs)
        return Response({"success": True, "data": resp.data})

    def update(self, request, *args, **kwargs):
        resp = super().update(request, *args, **kwargs)
        return Response({"success": True, "data": resp.data})

    def destroy(self, request, *args, **kwargs):
        super().destroy(request, *args, **kwargs)
        return Response({"success": True, "message": "Schedule deleted"}, status=status.HTTP_200_OK)


class AdminStopTimeViewSet(viewsets.ModelViewSet):
    """
    Guarded replacement for StopTimeViewSet's writes.
    """
    queryset = StopTime.objects.all().select_related("schedule", "stop")
    serializer_class = StopTimeSerializer
    permission_classes = [IsAdmin]

    def list(self, request, *args, **kwargs):
        resp = super().list(request, *args, **kwargs)
        return Response({"success": True, "data": resp.data})

    def create(self, request, *args, **kwargs):
        resp = super().create(request, *args, **kwargs)
        return Response({"success": True, "data": resp.data}, status=status.HTTP_201_CREATED)

    def retrieve(self, request, *args, **kwargs):
        resp = super().retrieve(request, *args, **kwargs)
        return Response({"success": True, "data": resp.data})

    def update(self, request, *args, **kwargs):
        resp = super().update(request, *args, **kwargs)
        return Response({"success": True, "data": resp.data})

    def destroy(self, request, *args, **kwargs):
        super().destroy(request, *args, **kwargs)
        return Response({"success": True, "message": "Stop time deleted"}, status=status.HTTP_200_OK)


class AdminCityViewSet(viewsets.ModelViewSet):
    """Admin city CRUD. Supports both slug URLs (Dynamic Routing) and UUID URLs (legacy Cities screen)."""
    queryset = City.objects.all().select_related("admin_configuration").prefetch_related("stops", "routes")
    serializer_class = AdminCitySerializer
    permission_classes = [IsAdmin]
    lookup_field = "slug"

    def get_object(self):
        lookup = self.kwargs.get(self.lookup_url_kwarg or self.lookup_field)
        qs = self.filter_queryset(self.get_queryset())
        obj = qs.filter(slug=lookup).first()
        if obj is None:
            try:
                lookup_id = UUID(str(lookup))
            except (TypeError, ValueError):
                lookup_id = None
            if lookup_id is not None:
                obj = qs.filter(pk=lookup_id).first()
        if obj is None:
            from django.http import Http404
            raise Http404("City not found")
        self.check_object_permissions(self.request, obj)
        return obj

    def list(self, request, *args, **kwargs):
        cities = [AdminCitySerializer(city, context={"request": request}).data
                  for city in self.filter_queryset(self.get_queryset()).order_by("name")]
        # results supports DynamicRouting.rowsOf(); data supports existing admin consumers.
        return Response({"success": True, "count": len(cities), "results": cities, "data": cities})

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        city = serializer.save()
        data = self.get_serializer(city).data
        return Response({"success": True, "data": data}, status=status.HTTP_201_CREATED)

    def retrieve(self, request, *args, **kwargs):
        return Response({"success": True, "data": self.get_serializer(self.get_object()).data})

    def update(self, request, *args, **kwargs):
        partial = kwargs.pop("partial", False)
        instance = self.get_object()
        serializer = self.get_serializer(instance, data=request.data, partial=partial)
        serializer.is_valid(raise_exception=True)
        city = serializer.save()
        return Response({"success": True, "data": self.get_serializer(city).data})

    def partial_update(self, request, *args, **kwargs):
        kwargs["partial"] = True
        return self.update(request, *args, **kwargs)

    def destroy(self, request, *args, **kwargs):
        city = self.get_object()
        city_name = city.name
        city.delete()
        return Response({"success": True, "message": f"City {city_name} deleted"}, status=status.HTTP_200_OK)


class AdminStopBulkUploadAPIView(APIView):
    """
    Create many stops from a CSV in one request.

    A row without a route column becomes a global stop; with one, a route stop.
    Duplicates are skipped rather than created, so re-uploading a corrected file
    is safe. Send ``dry_run`` to validate and report without writing.
    """

    permission_classes = [IsAdmin]

    # A spreadsheet of stops is small; the default body limit is fine but the
    # file is read whole, so cap it to avoid buffering something absurd.
    MAX_UPLOAD_BYTES = 5 * 1024 * 1024

    def post(self, request):
        upload = request.FILES.get("file")
        if upload is None:
            return error_response("Attach a CSV file in the 'file' field.")

        if upload.size > self.MAX_UPLOAD_BYTES:
            return error_response(
                f"File is larger than {self.MAX_UPLOAD_BYTES // (1024 * 1024)}MB."
            )

        # Trust the bytes over the client's content-type; spreadsheets often
        # send a generic type, and decoding fails loudly below if it is not CSV.
        try:
            csv_text = upload.read().decode("utf-8-sig")
        except UnicodeDecodeError:
            return error_response("The file must be UTF-8 encoded CSV.")

        dry_run = str(request.data.get("dry_run", "")).lower() in ("1", "true", "yes")

        try:
            summary, created = stop_import_service.bulk_import(
                csv_text, dry_run=dry_run
            )
        except stop_import_service.RowError as exc:
            return error_response(str(exc))

        # Route path geometry is built from ordered stops; a CSV import leaves
        # it empty, so the existing recalculate action refreshes it on demand.
        logger.info(
            "STOP IMPORT: dry_run=%s created=%s duplicate=%s invalid=%s by %s",
            dry_run,
            summary["created"],
            summary["duplicate"],
            summary["invalid"],
            getattr(request.user, "email", "unknown"),
        )

        verb = "Would import" if dry_run else "Imported"
        message = (
            f"{verb} {summary['created']} of {summary['total']} stops"
            f" ({summary['duplicate']} duplicate, {summary['invalid']} invalid)."
        )

        return success_response(
            data={
                "summary": summary,
                "created": [
                    {
                        "id": str(stop.id),
                        "name": stop.name,
                        "is_global": stop.is_global,
                        "location": [stop.location.x, stop.location.y],
                    }
                    for stop in created
                ],
                "dry_run": dry_run,
            },
            message=message,
            status_code=status.HTTP_201_CREATED if created else status.HTTP_200_OK,
        )


class AdminRouteImportAPIView(APIView):
    permission_classes = [IsAdmin]

    def post(self, request):
        city_id = request.data.get("city")
        route_name = request.data.get("route_name", "Imported Route")
        route_code = request.data.get("route_code", "")
        stops_input = request.data.get("stops", [])

        if not city_id:
            return Response(
                {"success": False, "message": "City is required"},
                status=status.HTTP_400_BAD_REQUEST,
            )
        try:
            city_uuid = UUID(str(city_id))
        except (TypeError, ValueError):
            return Response({"success": False, "message": "City must be a valid city ID."}, status=400)
        city = City.objects.filter(pk=city_uuid).first()
        if city is None:
            return Response({"success": False, "message": "City not found."}, status=404)

        if not stops_input or len(stops_input) < 2:
            return Response(
                {"success": False, "message": "Need at least 2 stops to create a route"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        stops_data = []
        for i, s in enumerate(stops_input):
            try:
                lat = float(s.get("lat", 0))
                lon = float(s.get("lon", 0))
            except (ValueError, TypeError):
                continue
            if not (-90 <= lat <= 90) or not (-180 <= lon <= 180):
                continue
            stops_data.append({
                "lat": lat,
                "lon": lon,
                "name": str(s.get("name") or f"Stop {i + 1}").strip()[:255],
                "order": int(s.get("order", i)),
                "plus_code": str(s.get("plus_code") or "")[:100],
                "nearby_landmark": str(s.get("nearby_landmark") or "")[:255],
            })

        if len(stops_data) < 2:
            return Response(
                {"success": False, "message": "Need at least 2 valid stops with lat/lon"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        stops_data.sort(key=lambda s: s["order"])

        osrm_coords = [(s["lon"], s["lat"]) for s in stops_data]
        all_waypoints = list(range(len(osrm_coords)))

        logger.info(f"IMPORT: Routing {len(osrm_coords)} stops via OSRM: {osrm_coords[:3]}...")

        osrm_result = OSRMService.route(
            *osrm_coords,
            geometries="geojson",
            overview="full",
            waypoints=all_waypoints,
        )

        road_coords = []
        total_distance = 0

        if osrm_result and osrm_result.get("routes"):
            route_geom = osrm_result["routes"][0]
            geometry = route_geom.get("geometry", {})
            coords = geometry.get("coordinates", [])
            if geometry.get("type") == "LineString" and len(coords) >= 2:
                road_coords = [tuple(c) for c in coords]
                total_distance = route_geom.get("distance", 0)
                logger.info(f"IMPORT: OSRM returned {len(road_coords)} geometry points, distance={total_distance}m")
            else:
                logger.warning(f"IMPORT: OSRM geometry invalid: type={geometry.get('type')}, coords={len(coords)}")
        else:
            err = osrm_result.get("code") if osrm_result else "no response"
            logger.warning(f"IMPORT: OSRM failed: {err}, result={osrm_result}")

        if not road_coords:
            logger.info("IMPORT: Falling back to straight-line geometry")
            road_coords = osrm_coords
            for i in range(len(road_coords) - 1):
                lon1, lat1 = road_coords[i]
                lon2, lat2 = road_coords[i + 1]
                R = 6371000
                dlat = radians(lat2 - lat1)
                dlon = radians(lon2 - lon1)
                a = sin(dlat / 2) ** 2 + cos(radians(lat1)) * cos(radians(lat2)) * sin(dlon / 2) ** 2
                total_distance += R * 2 * atan2(sqrt(a), sqrt(1 - a))

        path = LineString(road_coords, srid=4326)

        with transaction.atomic():
            route = Route.objects.create(
                city=city,
                name=route_name,
                route_code=route_code,
                path=path,
                start_name=stops_data[0]["name"],
                end_name=stops_data[-1]["name"],
                total_distance_meters=round(total_distance, 2),
            )
            stop_objs = [
                Stop(
                    route=route,
                    city=city,
                    name=s["name"],
                    location=Point(s["lon"], s["lat"], srid=4326),
                    order=s["order"],
                    coordinate_status="verified",
                    aliases=[s["name"]] if s.get("name") else [],
                    plus_code=s.get("plus_code", ""),
                    nearby_landmark=s.get("nearby_landmark", ""),
                )
                for s in stops_data
            ]
            Stop.objects.bulk_create(stop_objs)

        return Response({
            "success": True,
            "data": {
                "route": RouteDetailSerializer(route).data,
                "stops_created": len(stop_objs),
                "road_snapped": len(road_coords) > len(osrm_coords),
                "geometry_points": len(road_coords),
                "message": f"Route imported with {len(stop_objs)} stops and {len(road_coords)} road-snapped geometry points",
            },
        }, status=status.HTTP_201_CREATED)
