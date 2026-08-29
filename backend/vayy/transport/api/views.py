import logging
import json
from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework import serializers, status
from django.contrib.gis.db.models.functions import Distance
from django.contrib.gis.geos import Point, LineString
from django.contrib.gis.measure import D

from transport.api.serializers import (
    CitySerializer,
    NearbyStopSerializer,
    RouteListSerializer,
    RouteDetailSerializer,
    StopSerializer,
    TripScheduleSerializer,
    StopTimeSerializer,
    DriverRouteSerializer,
)
from transport.models import City, Stop, Route, TripSchedule, StopTime
from tracking.services.eta_service import ETAService
from tracking.services.geo_service import GeoService
from transport.selectors.city_selector import CitySelector
from transport.selectors.route_selector import RouteSelector
from transport.selectors.driver_route_selector import DriverRouteSelector
from transport.services.route_service import RouteService
from transport.services.osrm_service import OSRMService

logger = logging.getLogger(__name__)

class CityViewSet(viewsets.ModelViewSet):
    queryset = City.objects.all()
    serializer_class = CitySerializer
    permission_classes = [AllowAny]

    def get_queryset(self):
        return CitySelector.list_cities()

    def list(self, request, *args, **kwargs):
        resp = super().list(request, *args, **kwargs)
        return resp

    def create(self, request, *args, **kwargs):
        resp = super().create(request, *args, **kwargs)
        return resp

    def update(self, request, *args, **kwargs):
        resp = super().update(request, *args, **kwargs)
        return resp

    def destroy(self, request, *args, **kwargs):
        resp = super().destroy(request, *args, **kwargs)
        return resp

class RouteViewSet(viewsets.ModelViewSet):
    queryset = Route.objects.all()
    permission_classes = [AllowAny]

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

    def list(self, request, *args, **kwargs):
        resp = super().list(request, *args, **kwargs)
        return resp

    def create(self, request, *args, **kwargs):
        resp = super().create(request, *args, **kwargs)
        return resp

    def update(self, request, *args, **kwargs):
        resp = super().update(request, *args, **kwargs)
        return resp

    def destroy(self, request, *args, **kwargs):
        resp = super().destroy(request, *args, **kwargs)
        return resp

    @action(detail=True, methods=['post'])
    def recalculate_distance(self, request, pk=None):
        route = self.get_object()
        distance = RouteService.recalculate_route_distance(route.id)
        resp = Response({
            "success": True,
            "total_distance_meters": distance
        })
        return resp

class StopViewSet(viewsets.ModelViewSet):
    queryset = Stop.objects.all()
    serializer_class = StopSerializer
    permission_classes = [AllowAny]

    def list(self, request, *args, **kwargs):
        resp = super().list(request, *args, **kwargs)
        return resp

    def create(self, request, *args, **kwargs):
        resp = super().create(request, *args, **kwargs)
        return resp

    def update(self, request, *args, **kwargs):
        resp = super().update(request, *args, **kwargs)
        return resp

    def destroy(self, request, *args, **kwargs):
        resp = super().destroy(request, *args, **kwargs)
        return resp

class TripScheduleViewSet(viewsets.ModelViewSet):
    queryset = TripSchedule.objects.all()
    serializer_class = TripScheduleSerializer
    permission_classes = [AllowAny]

    def list(self, request, *args, **kwargs):
        resp = super().list(request, *args, **kwargs)
        return resp

    def create(self, request, *args, **kwargs):
        resp = super().create(request, *args, **kwargs)
        return resp

    def update(self, request, *args, **kwargs):
        resp = super().update(request, *args, **kwargs)
        return resp

    def destroy(self, request, *args, **kwargs):
        resp = super().destroy(request, *args, **kwargs)
        return resp

class StopTimeViewSet(viewsets.ModelViewSet):
    queryset = StopTime.objects.all()
    serializer_class = StopTimeSerializer
    permission_classes = [AllowAny]

    def list(self, request, *args, **kwargs):
        resp = super().list(request, *args, **kwargs)
        return resp

    def create(self, request, *args, **kwargs):
        resp = super().create(request, *args, **kwargs)
        return resp

    def update(self, request, *args, **kwargs):
        resp = super().update(request, *args, **kwargs)
        return resp

    def destroy(self, request, *args, **kwargs):
        resp = super().destroy(request, *args, **kwargs)
        return resp

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

    def validate_origin_lat(self, value):
        if value < -90 or value > 90:
            raise serializers.ValidationError("origin_lat must be between -90 and 90.")
        return value

    def validate_dest_lat(self, value):
        if value < -90 or value > 90:
            raise serializers.ValidationError("dest_lat must be between -90 and 90.")
        return value

    def validate_origin_lng(self, value):
        if value < -180 or value > 180:
            raise serializers.ValidationError("origin_lng must be between -180 and 180.")
        return value

    def validate_dest_lng(self, value):
        if value < -180 or value > 180:
            raise serializers.ValidationError("dest_lng must be between -180 and 180.")
        return value

class RouteSearchByLocationAPIView(APIView):
    """
    GET /api/transport/routes/search-by-location/

    Returns routes that have stops near both the origin and destination points,
    enriched with estimated fare, ETA, rating, and all stops.
    Query params: origin_lat, origin_lng, dest_lat, dest_lng, radius (optional, default 1000m)
    """
    permission_classes = [AllowAny]

    def get(self, request):
        serializer = RouteSearchByLocationSerializer(data=request.query_params)
        serializer.is_valid(raise_exception=True)

        params = serializer.validated_data
        origin_point = Point(params["origin_lng"], params["origin_lat"], srid=4326)
        dest_point = Point(params["dest_lng"], params["dest_lat"], srid=4326)

        routes = RouteSelector.search_routes_by_location(**params)

        results = []
        for route in routes:
            stops = list(route.stops.all().order_by("order"))
            if not stops:
                continue

            pickup_stop = min(
                stops, key=lambda s: origin_point.distance(s.location)
            )
            pickup_dist_m = GeoService.haversine_m(
                origin_point.y, origin_point.x, pickup_stop.location.y, pickup_stop.location.x
            )

            later_stops = [s for s in stops if s.order > pickup_stop.order]
            if later_stops:
                dropoff_stop = min(
                    later_stops, key=lambda s: dest_point.distance(s.location)
                )
                dropoff_dist_m = GeoService.haversine_m(
                    dest_point.y, dest_point.x, dropoff_stop.location.y, dropoff_stop.location.x
                )
            else:
                dropoff_stop = stops[-1]
                dropoff_dist_m = GeoService.haversine_m(
                    dest_point.y, dest_point.x, dropoff_stop.location.y, dropoff_stop.location.x
                )

            from transport.services.osrm_service import OSRMService
            metrics = OSRMService.get_road_metrics(
                (pickup_stop.location.x, pickup_stop.location.y),
                (dropoff_stop.location.x, dropoff_stop.location.y),
            )
            stop_duration_s = metrics["duration"] if metrics else None
            stop_distance_m = metrics["distance"] if metrics else None

            if stop_distance_m is not None and stop_distance_m > 0:
                stop_distance_km = round(stop_distance_m / 1000, 1)
            else:
                stop_distance_m = GeoService.haversine_m(
                    pickup_stop.location.y, pickup_stop.location.x,
                    dropoff_stop.location.y, dropoff_stop.location.x,
                )
                stop_distance_km = round(stop_distance_m / 1000, 1)

            if stop_duration_s is not None and stop_duration_s > 0:
                eta_seconds = int(stop_duration_s)
            else:
                speed_kmh = 25
                eta_seconds = (
                    int((stop_distance_km / speed_kmh) * 3600)
                    if stop_distance_km > 0
                    else 600
                )

            from operations.services.fare_service import FareService
            fare = int(FareService.calculate_fare(stop_distance_km, "auto"))

            walk_pickup_min = max(1, round(pickup_dist_m / 80))
            walk_dropoff_min = max(1, round(dropoff_dist_m / 80))

            def _stop_json(s):
                return {
                    "id": str(s.id),
                    "name": s.name,
                    "order": s.order,
                    "lat": s.location.y,
                    "lon": s.location.x,
                    "location": {"type": "Point", "coordinates": [s.location.x, s.location.y]},
                }

            stops_data = [_stop_json(s) for s in stops]
            pickup_json = _stop_json(pickup_stop)
            dropoff_json = _stop_json(dropoff_stop)

            results.append({
                "id": str(route.id),
                "name": route.name,
                "route_code": route.route_code,
                "city_name": route.city.name if route.city else "",
                "start_name": route.start_name,
                "end_name": route.end_name,
                "total_distance_meters": route.total_distance_meters,
                "fare": fare,
                "eta_seconds": eta_seconds,
                "rating": 4.5,
                "review_count": 128,
                "walk_minutes": walk_pickup_min,
                "vehicle_type": "auto",
                "payment_method": "Cash",
                "distance_km": stop_distance_km,
                "is_route_only": False,
                "trip_available": True,
                "pickup_stop": pickup_json,
                "dropoff_stop": dropoff_json,
                "stops": stops_data,
            })

        logger.info(f"[RouteSearchByLocation] Found {len(results)} routes for origin=({params['origin_lat']},{params['origin_lng']}) dest=({params['dest_lat']},{params['dest_lng']})")
        resp = Response({
            "success": True,
            "message": f"Found {len(results)} routes",
            "data": results,
        })
        return resp

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
            user__role="driver",
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
        results = GeocodingService.search(query, limit=limit, country_codes=country_codes)
        return Response(results, status=status.HTTP_200_OK)


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
