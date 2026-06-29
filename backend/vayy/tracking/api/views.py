import logging
import json
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated, AllowAny
from rest_framework import status
from rest_framework.exceptions import PermissionDenied, ValidationError

from accounts.permissions import IsDriver, IsPassenger
from operations.models import VehicleState, Vehicle, ActiveTrip
from operations.services.ride_service import RideService
from tracking.selectors.hybrid_selector import HybridSelector
from tracking.api.serializers import (
    HybridLogSerializer,
    TelemetryIngestSerializer,
)
from tracking.services.geo_service import GeoService
from tracking.services.gps_service import GPSService
from tracking.services.redis_geo_service import RedisGeoService
from tracking.tasks import process_location_update, process_passenger_location

logger = logging.getLogger(__name__)


def _log_request(view_name, request, extra=None):
    data = {}
    if hasattr(request, 'data') and request.data:
        try:
            data = json.loads(json.dumps(request.data, default=str))
        except Exception:
            data = str(request.data)
    if hasattr(request, 'query_params') and request.query_params:
        data = dict(request.query_params)
    logger.info(
        f"[{view_name}] REQUEST | method={request.method} path={request.path} "
        f"user={getattr(request.user, 'id', 'anonymous')} data={data} {extra or ''}"
    )


def _log_response(view_name, response, extra=None):
    resp_data = {}
    try:
        resp_data = json.loads(json.dumps(response.data, default=str)) if hasattr(response, 'data') else {}
    except Exception:
        resp_data = str(getattr(response, 'data', {}))
    logger.info(
        f"[{view_name}] RESPONSE | status={response.status_code} data={resp_data} {extra or ''}"
    )


class VehicleTrackingAPIView(APIView):
    """
    GET /tracking/vehicle/{id}
    Returns location history for a vehicle.
    """
    permission_classes = [IsAuthenticated]

    def get(self, request, vehicle_id):
        _log_request("VehicleTracking", request, extra=f"vehicle_id={vehicle_id}")
        logs = HybridSelector.list_vehicle_logs(vehicle_id)
        resp = Response(HybridLogSerializer(logs, many=True).data)
        _log_response("VehicleTracking", resp, extra=f"log_count={len(logs)}")
        return resp


class TripTrackingAPIView(APIView):
    """
    GET /tracking/trip/{id}
    Returns location history for a trip.
    """
    permission_classes = [IsAuthenticated]

    def get(self, request, trip_id):
        _log_request("TripTracking", request, extra=f"trip_id={trip_id}")
        logs = HybridSelector.list_trip_logs(trip_id)
        resp = Response(HybridLogSerializer(logs, many=True).data)
        _log_response("TripTracking", resp, extra=f"log_count={len(logs)}")
        return resp


class GPSIngestAPIView(APIView):
    """
    POST /tracking/gps
    Raw GPS ingestion endpoint for drivers.
    """
    # permission_classes = [IsAuthenticated, IsDriver]
    # permission_classes = [IsAuthenticated]

    def post(self, request):
        _log_request("GPSIngest", request)
        serializer = TelemetryIngestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        vehicle = serializer.validated_data.get("vehicle")
        trip = serializer.validated_data.get("trip")

        # Security Check
        if vehicle and vehicle.driver_id != request.user.id:
            logger.warning(f"[GPSIngest] Unauthorized telemetry attempt by user {request.user.id} for vehicle {vehicle.id}")
            raise PermissionDenied("Vehicle is not assigned to this driver.")

        if trip and trip.driver_id != request.user.id:
            logger.warning(f"[GPSIngest] Unauthorized telemetry attempt by user {request.user.id} for trip {trip.id}")
            raise PermissionDenied("Trip is not assigned to this driver.")

        try:
            # GPSService.ingest will publish an event for async processing of state
            log = GPSService.ingest(
                user=request.user,
                vehicle=vehicle,
                trip=trip,
                lat=serializer.validated_data["lat"],
                lng=serializer.validated_data["lng"],
                speed=serializer.validated_data.get("speed", 0),
                heading=serializer.validated_data.get("heading", 0),
                cell_towers=serializer.validated_data.get("cell_towers", []),
                wifi_aps=serializer.validated_data.get("wifi_aps", []),
            )
            
            logger.info(f"[GPSIngest] Successfully ingested GPS data for vehicle {vehicle.id if vehicle else 'N/A'}")
            resp = Response(
                HybridLogSerializer(log).data,
                status=status.HTTP_201_CREATED
            )
            _log_response("GPSIngest", resp)
            return resp
        except Exception as e:
            logger.exception("[GPSIngest] Failed to ingest GPS data")
            return Response(
                {"detail": "Internal error during ingestion"},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )


class TelemetryIngestAPIView(GPSIngestAPIView):
    """
    Alias for GPSIngestAPIView to support existing clients.
    """
    pass


class NearbyVehiclesAPIView(APIView):
    """
    GET /api/tracking/nearby
    Finds active vehicles near a location using Redis GEO.
    Falls back to DB if Redis returns no results.
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        _log_request("NearbyVehicles", request)
        try:
            lat = float(request.query_params.get('lat', 0))
            lng = float(request.query_params.get('lng', 0))
            radius = int(request.query_params.get('radius', 5000))
            vehicle_type = request.query_params.get('vehicle_type')

            if not lat or not lng:
                return Response({
                    "success": False,
                    "message": "lat and lng query parameters are required",
                    "data": {}
                }, status=status.HTTP_400_BAD_REQUEST)

            # Primary: fetch from Redis GEO set
            vehicles = RedisGeoService.get_nearby(lat, lng, radius, vehicle_type)

            if vehicles:
                resp = Response({
                    "success": True,
                    "message": f"Found {len(vehicles)} nearby vehicles",
                    "data": vehicles
                })
                _log_response("NearbyVehicles", resp)
                return resp

            # Fallback: query DB if Redis has no results (cold start / cache miss)
            logger.info("[NearbyVehicles] Redis miss, falling back to DB")
            db_vehicles = RideService.get_nearby_vehicles(lat, lng, radius, vehicle_type)

            from operations.api.serializers import VehicleStateSerializer
            serialized = VehicleStateSerializer(db_vehicles, many=True).data

            resp = Response({
                "success": True,
                "message": f"Found {len(serialized)} nearby vehicles (db fallback)",
                "data": serialized
            })
            _log_response("NearbyVehicles", resp)
            return resp
        except Exception as e:
            logger.exception("[NearbyVehicles] Nearby vehicles search failed")
            return Response({
                "success": False,
                "message": "Internal error during search",
                "data": {}
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class PassengerLocationAPIView(APIView):
    """
    POST /api/tracking/passenger-location/
    Passengers push their GPS location here.
    Publishes to RabbitMQ → consumed → broadcast to route WS groups.
    """
    permission_classes = [IsAuthenticated, IsPassenger]

    def post(self, request):
        _log_request("PassengerLocation", request)
        lat = request.data.get("lat")
        lng = request.data.get("lng") or request.data.get("lon")

        if lat is None or lng is None:
            logger.warning(f"[PassengerLocation] Missing lat/lng from user {request.user.id}")
            return Response(
                {"success": False, "message": "lat and lng are required"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            from django.contrib.gis.geos import Point
            from django.utils import timezone
            from accounts.models import PublicPassengerProfile

            profile, _ = PublicPassengerProfile.objects.get_or_create(user=request.user)
            profile.current_location = Point(float(lng), float(lat), srid=4326)
            profile.last_active_at = timezone.now()
            profile.save()

            saved_route_ids = list(profile.saved_routes.values_list("id", flat=True))

            process_passenger_location.delay({
                "user_id": str(request.user.id),
                "lat": float(lat),
                "lng": float(lng),
                "display_name": profile.display_name or request.user.full_name or request.user.email.split("@")[0],
                "route_ids": [str(r) for r in saved_route_ids],
            })

            logger.info(f"[PassengerLocation] Location updated for user {request.user.id}: lat={lat} lng={lng} saved_routes={len(saved_route_ids)}")
            resp = Response({"success": True, "message": "Location updated"})
            _log_response("PassengerLocation", resp)
            return resp
        except Exception as e:
            logger.exception(f"[PassengerLocation] Failed to update passenger location: {e}")
            return Response(
                {"success": False, "message": str(e)},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )


class DriverLocationAPIView(APIView):
    """
    POST /api/tracking/driver-location/
    Drivers push their GPS location here.
    Publishes to RabbitMQ → consumer → Celery → LocationService → Redis GEO + DB + WS.

    Request body:
        {
            "vehicle_id": "<uuid>",
            "lat": 28.6139,
            "lng": 77.209,
            "speed": 25.0,       (optional)
            "heading": 90.0,     (optional)
            "trip_id": "<uuid>"  (optional)
        }
    """
    permission_classes = [IsAuthenticated, IsDriver]

    def post(self, request):
        _log_request("DriverLocation", request)

        vehicle_id = request.data.get("vehicle_id")
        lat = request.data.get("lat")
        lng = request.data.get("lng") or request.data.get("lon")
        speed = request.data.get("speed", 0)
        heading = request.data.get("heading", 0)
        trip_id = request.data.get("trip_id")

        if not vehicle_id or lat is None or lng is None:
            return Response(
                {"success": False, "message": "vehicle_id, lat, and lng are required"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            # Verify vehicle belongs to this driver
            from operations.models import Vehicle
            try:
                vehicle = Vehicle.objects.get(id=vehicle_id)
            except Vehicle.DoesNotExist:
                return Response(
                    {"success": False, "message": "Vehicle not found"},
                    status=status.HTTP_404_NOT_FOUND,
                )

            if vehicle.driver_id != request.user.id:
                logger.warning(
                    f"[DriverLocation] Unauthorized: user {request.user.id} "
                    f"tried to update vehicle {vehicle_id} owned by {vehicle.driver_id}"
                )
                raise PermissionDenied("Vehicle is not assigned to this driver.")

            # Publish to Celery for async processing
            payload = {
                "vehicle_id": str(vehicle_id),
                "lat": float(lat),
                "lng": float(lng),
                "speed": float(speed),
                "heading": float(heading),
                "vehicle_type": vehicle.vehicle_type,
            }
            if trip_id:
                payload["trip_id"] = str(trip_id)

            process_location_update.delay(payload)

            logger.info(
                f"[DriverLocation] Dispatched GPS for vehicle {vehicle_id}: "
                f"lat={lat} lng={lng} speed={speed} heading={heading}"
            )

            resp = Response({
                "success": True,
                "message": "Location published to processing queue",
            })
            _log_response("DriverLocation", resp)
            return resp

        except PermissionDenied:
            raise
        except Exception as e:
            logger.exception(f"[DriverLocation] Failed to publish location: {e}")
            return Response(
                {"success": False, "message": str(e)},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )
