import logging
import time
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated, AllowAny
from rest_framework import status
from rest_framework.exceptions import PermissionDenied, ValidationError
from rest_framework.throttling import ScopedRateThrottle, UserRateThrottle

from django.utils import timezone

from accounts.permissions import IsDriver, IsPassenger
from common.constants import JOURNEY_CORRIDOR_RADIUS_M
from operations.models import VehicleState, Vehicle, ActiveTrip, BoardingRequest
from operations.models import DispatchRequest
from operations.services.ride_service import RideService
from tracking.selectors.hybrid_selector import HybridSelector
from tracking.api.serializers import (
    HybridLogSerializer,
    TelemetryIngestSerializer,
    StartRouteTripSerializer,
    StartJourneySerializer,
    CorridorSearchSerializer,
    PreviewJourneySerializer,
    EndJourneySerializer,
    PassengerRaiseHandSerializer,
    RideLifecycleSerializer,
    RouteStopListSerializer,
)
from tracking.services.geo_service import GeoService
from tracking.services.gps_service import GPSService
from tracking.services.redis_geo_service import RedisGeoService
from tracking.services.redis_route_service import RedisRouteService
from tracking.services.matching_service import MatchingService
from tracking.services.corridor_service import CorridorService
from tracking.services.corridor_search_service import CorridorSearchService
from tracking.services.journey_cache_service import JourneyCacheService
from operations.services.journey_service import JourneyService
from operations.services.dispatch_service import DispatchService, _user_display_name
from tracking.tasks import (
    process_location_update,
    process_passenger_location,
    process_ride_request,
    process_ride_lifecycle,
)
from common.constants import TRIP_STATUS_ACTIVE, TRIP_STATUS_COMPLETED, BOARDING_PENDING
from transport.models import Route, Stop

logger = logging.getLogger(__name__)

class VehicleTrackingAPIView(APIView):
    """
    GET /tracking/vehicle/{id}
    Returns location history for a vehicle (capped to latest 100 logs).
    """
    permission_classes = [IsAuthenticated]

    def get(self, request, vehicle_id):
        logs = HybridSelector.list_vehicle_logs(vehicle_id)
        resp = Response(HybridLogSerializer(logs, many=True).data)
        return resp

class TripTrackingAPIView(APIView):
    """
    GET /tracking/trip/{id}
    Returns location history for a trip (capped to latest 100 logs).
    """
    permission_classes = [IsAuthenticated]

    def get(self, request, trip_id):
        logs = HybridSelector.list_trip_logs(trip_id)
        resp = Response(HybridLogSerializer(logs, many=True).data)
        return resp

class GPSDailyRateThrottle(UserRateThrottle):
    """
    Per-user/day ceiling for GPS ingestion.

    A throttle scope maps to exactly one rate, so the 1 Hz per-minute budget
    and the all-day ceiling cannot both live on the "gps" scope. This class
    applies the "gps_day" rate against the authenticated user's PK, giving the
    stream a daily bound without loosening the global "user" rate.
    """

    scope = "gps_day"


class GPSIngestAPIView(APIView):
    """
    POST /tracking/gps
    Raw GPS ingestion endpoint for drivers.
    High-volume real-time endpoint - scoped per-minute ("gps") plus a
    per-user/day ceiling ("gps_day").
    """
    throttle_classes = [ScopedRateThrottle, GPSDailyRateThrottle]
    throttle_scope = "gps"
    # permission_classes = [IsAuthenticated, IsDriver]
    # permission_classes = [IsAuthenticated]

    def post(self, request):
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
    Drivers push their GPS location here (legacy HTTP fallback; the app now
    streams over WebSocket). Runs the Redis/broadcast hot path inline and
    throttles the DB/OSRM cold path to one Celery job per 15s per vehicle.

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

            # Hot path inline (Redis GEO + broadcast), cold path throttled.
            from tracking.services.location_service import LocationService
            LocationService.hot_path_process(payload)
            if LocationService.should_enqueue_cold_path(str(vehicle_id)):
                process_location_update.delay(payload)

            logger.info(
                f"[DriverLocation] Processed GPS for vehicle {vehicle_id}: "
                f"lat={lat} lng={lng} speed={speed} heading={heading}"
            )

            resp = Response({
                "success": True,
                "message": "Location published to processing queue",
            })
            return resp

        except PermissionDenied:
            raise
        except Exception as e:
            logger.exception(f"[DriverLocation] Failed to publish location: {e}")
            return Response(
                {"success": False, "message": str(e)},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )

# ──────────────────────────────────────────────────────────────
# Route-based trip management
# ──────────────────────────────────────────────────────────────

class StartRouteTripView(APIView):
    """
    POST /api/tracking/start-route-trip/
    Driver selects a route and starts a trip.

    Request:
        { "vehicle_id": "<uuid>", "route_id": "<uuid>", "direction": "outbound" }

    Creates ActiveTrip, registers vehicle in Redis route state,
    and returns trip details + ordered stops.
    """
    permission_classes = [IsAuthenticated, IsDriver]

    def post(self, request):
        serializer = StartRouteTripSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        vehicle = serializer.validated_data["_vehicle"]
        route = serializer.validated_data["_route"]
        direction = serializer.validated_data["direction"]

        if vehicle.driver_id != request.user.id:
            raise PermissionDenied("Vehicle is not assigned to this driver.")

        try:
            # Fetch ordered stops with cumulative distances
            stops = list(route.stops.order_by("order"))
            if not stops:
                return Response(
                    {"success": False, "message": "Route has no stops defined."},
                    status=status.HTTP_400_BAD_REQUEST,
                )

            # Compute cumulative distances if not yet set
            from tracking.services.location_service import _haversine_m, _point_to_tuple
            cumulative = 0.0
            for i, stop in enumerate(stops):
                if i == 0:
                    stop.cumulative_distance_m = 0
                    stop.cumulative_duration_s = 0
                else:
                    prev = stops[i - 1]
                    seg_dist = _haversine_m(
                        _point_to_tuple(prev.location),
                        _point_to_tuple(stop.location),
                    )
                    cumulative += seg_dist
                    stop.cumulative_distance_m = round(cumulative, 1)
                    # Rough duration estimate: 20 km/h average
                    stop.cumulative_duration_s = round(cumulative / (20 * 1000 / 3600), 1)
                stop.save(update_fields=["cumulative_distance_m", "cumulative_duration_s"])

            # Determine starting stop based on direction
            start_stop = stops[0] if direction == "outbound" else stops[-1]

            # Create ActiveTrip
            trip = ActiveTrip.objects.create(
                vehicle=vehicle,
                route=route,
                driver=request.user,
                status=TRIP_STATUS_ACTIVE,
                direction=direction,
                current_stop=start_stop,
                current_segment_index=start_stop.order,
            )

            # Update VehicleState
            state, _ = VehicleState.objects.get_or_create(vehicle=vehicle)
            state.active_trip = trip
            state.current_stop_index = start_stop.order
            state.current_segment_index = start_stop.order
            state.save(update_fields=["active_trip", "current_stop_index", "current_segment_index"])

            # Register in Redis
            RedisRouteService.add_active_trip(str(route.id), str(trip.id))
            RedisRouteService.set_vehicle_route_state(
                vehicle_id=str(vehicle.id),
                route_id=str(route.id),
                direction=direction,
                current_stop_index=start_stop.order,
                current_segment_index=start_stop.order,
                distance_along_route_m=start_stop.cumulative_distance_m,
                last_stop_id=str(start_stop.id),
            )

            logger.info(
                f"[StartRouteTrip] Trip {trip.id} started on route {route.name} "
                f"direction={direction} start_stop={start_stop.name}"
            )

            resp = Response({
                "success": True,
                "message": f"Trip started on {route.name}",
                "data": {
                    "trip_id": str(trip.id),
                    "route_id": str(route.id),
                    "route_name": route.name,
                    "direction": direction,
                    "start_stop": {
                        "id": str(start_stop.id),
                        "name": start_stop.name,
                        "order": start_stop.order,
                    },
                    "total_stops": len(stops),
                    "total_distance_m": round(cumulative, 1),
                    "stops": [
                        {
                            "id": str(s.id),
                            "name": s.name,
                            "order": s.order,
                            "cumulative_distance_m": s.cumulative_distance_m,
                        }
                        for s in stops
                    ],
                },
            })
            return resp

        except PermissionDenied:
            raise
        except Exception as e:
            logger.exception(f"[StartRouteTrip] Failed: {e}")
            return Response(
                {"success": False, "message": str(e)},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )

class EndRouteTripView(APIView):
    """
    POST /api/tracking/end-route-trip/
    Driver ends an active route trip.

    Request: { "trip_id": "<uuid>" }
    """
    permission_classes = [IsAuthenticated, IsDriver]

    def post(self, request):
        trip_id = request.data.get("trip_id")
        if not trip_id:
            return Response(
                {"success": False, "message": "trip_id is required"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            trip = ActiveTrip.objects.get(id=trip_id, driver=request.user, status=TRIP_STATUS_ACTIVE)
        except ActiveTrip.DoesNotExist:
            return Response(
                {"success": False, "message": "Active trip not found"},
                status=status.HTTP_404_NOT_FOUND,
            )

        from django.utils import timezone
        trip.status = TRIP_STATUS_COMPLETED
        trip.ended_at = timezone.now()
        trip.save(update_fields=["status", "ended_at"])

        # Clean up Redis
        RedisRouteService.remove_active_trip(str(trip.route_id), str(trip.id))
        RedisRouteService.remove_vehicle_from_route(str(trip.route_id), str(trip.vehicle_id))
        RedisRouteService.clear_vehicle_route_state(str(trip.vehicle_id))

        # Update VehicleState
        state, _ = VehicleState.objects.get_or_create(vehicle=trip.vehicle)
        state.active_trip = None
        state.current_stop_index = 0
        state.current_segment_index = 0
        state.distance_along_route_m = 0
        state.snapped_location = None
        state.save()

        logger.info(f"[EndRouteTrip] Trip {trip.id} completed")

        resp = Response({"success": True, "message": "Trip ended"})
        return resp

# ──────────────────────────────────────────────────────────────
# Passenger ride request ("raise hand")
# ──────────────────────────────────────────────────────────────

class PassengerRaiseHandView(APIView):
    """
    POST /api/tracking/raise-hand/
    Passenger requests a ride.

    Two shapes, decided by whether ``route_id`` is sent:

    * route-scoped - pickup and dropoff stops on a registered fixed route. A
      BoardingRequest is created against an active trip on that route and the
      matching worker runs.
    * journey-scoped - ``route_id`` omitted, pickup is an admin-created global
      stop. The request is offered to whichever drivers' journeys pass that
      stop, through the normal broadcast dispatch, and a driver's accept attaches
      the passenger to their live journey.
    """
    permission_classes = [IsAuthenticated, IsPassenger]

    def post(self, request):
        serializer = PassengerRaiseHandSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        route_id = serializer.validated_data["route_id"]
        pickup_stop = serializer.validated_data["_pickup"]
        dropoff_stop = serializer.validated_data["_dropoff"]
        lat = serializer.validated_data["lat"]
        lng = serializer.validated_data["lng"]

        if route_id is None:
            return self._raise_hand_on_stop(request, pickup_stop, dropoff_stop)

        return self._raise_hand_on_route(request, route_id, pickup_stop, dropoff_stop, lat, lng)

    def _raise_hand_on_stop(self, request, pickup_stop, dropoff_stop):
        """Journey-scoped: broadcast to the drivers passing this global stop."""
        # One open hand per passenger per stop: a second raise at the same stop
        # would create a second competing request rather than refresh the first.
        #
        # ``expires_at`` is honoured here rather than relying on a sweep: the
        # request lives 45s, and if the sweeper is not running (beat is a
        # separate, optional service) an expired request would otherwise keep
        # blocking this passenger from ever raising a hand at that stop again.
        now = timezone.now()
        existing = (
            DispatchRequest.objects.filter(
                passenger=request.user,
                pickup_stop=pickup_stop,
                status=DispatchRequest.STATUS_PENDING,
            )
            .filter(expires_at__gt=now)
            .order_by("-created_at")
            .first()
        )
        if existing:
            return Response(
                {
                    "success": False,
                    "message": "You already have a pending request at this stop",
                    "data": {"request_id": str(existing.id)},
                },
                status=status.HTTP_409_CONFLICT,
            )

        # Retire anything already past its deadline so the state matches what the
        # caller is told, and so a later read does not resurrect it.
        DispatchRequest.objects.filter(
            passenger=request.user,
            pickup_stop=pickup_stop,
            status=DispatchRequest.STATUS_PENDING,
            expires_at__lte=now,
        ).update(status=DispatchRequest.STATUS_EXPIRED)

        result = DispatchService.request_dispatch(
            passenger=request.user,
            route_id=None,
            pickup_stop_id=str(pickup_stop.id),
            drop_stop_id=str(dropoff_stop.id) if dropoff_stop else None,
        )

        if result.get("status") == "no_drivers_available":
            return Response(
                {
                    "success": False,
                    "message": "No vehicles are passing this stop right now",
                    "data": {},
                },
                status=status.HTTP_404_NOT_FOUND,
            )

        # The broadcast request id is what the passenger listens on
        # (/ws/dispatch/broadcast/{request_id}/), so it is the handle returned.
        request_id = result.get("request_id")
        if not request_id:
            return Response(
                {
                    "success": False,
                    "message": result.get("message", "Could not raise a request"),
                    "data": {},
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        logger.info(
            "[PassengerRaiseHand] Journey request %s at stop %s (%s drivers notified)",
            request_id,
            pickup_stop.id,
            result.get("drivers_notified"),
        )

        return Response(
            {
                "success": True,
                "message": "Searching for vehicles passing this stop...",
                "data": {
                    "request_id": str(request_id),
                    "pickup_stop": {
                        "id": str(pickup_stop.id),
                        "name": pickup_stop.name,
                        "lat": pickup_stop.location.y,
                        "lng": pickup_stop.location.x,
                    },
                    "dropoff_stop": (
                        {
                            "id": str(dropoff_stop.id),
                            "name": dropoff_stop.name,
                            "lat": dropoff_stop.location.y,
                            "lng": dropoff_stop.location.x,
                        }
                        if dropoff_stop
                        else None
                    ),
                    "drivers_notified": result.get("drivers_notified"),
                },
            },
            status=status.HTTP_201_CREATED,
        )

    def _raise_hand_on_route(self, request, route_id, pickup_stop, dropoff_stop, lat, lng):
        """Route-scoped: board an active trip running on a fixed route."""
        try:
            # Check for existing pending request on this route
            existing = BoardingRequest.objects.filter(
                passenger=request.user,
                status=BOARDING_PENDING,
                pickup_stop__route_id=route_id,
            ).exists()
            if existing:
                return Response(
                    {"success": False, "message": "You already have a pending request on this route"},
                    status=status.HTTP_409_CONFLICT,
                )

            # Find an active trip on this route to associate with
            active_trip = ActiveTrip.objects.filter(
                route_id=route_id, status=TRIP_STATUS_ACTIVE
            ).select_related("vehicle").first()

            if not active_trip:
                return Response(
                    {"success": False, "message": "No active trips on this route right now"},
                    status=status.HTTP_404_NOT_FOUND,
                )

            boarding = BoardingRequest.objects.create(
                passenger=request.user,
                trip=active_trip,
                pickup_stop=pickup_stop,
                drop_stop=dropoff_stop,
                status=BOARDING_PENDING,
            )

            # Dispatch async matching
            process_ride_request.delay({
                "request_id": str(boarding.id),
                "passenger_id": str(request.user.id),
                "route_id": str(route_id),
                "pickup_stop_id": str(pickup_stop.id),
                "dropoff_stop_id": str(dropoff_stop.id),
                "passenger_lat": lat,
                "passenger_lng": lng,
            })

            logger.info(
                f"[PassengerRaiseHand] Request {boarding.id} created for route {route_id} "
                f"pickup={pickup_stop.name} dropoff={dropoff_stop.name}"
            )

            resp = Response({
                "success": True,
                "message": "Searching for drivers...",
                "data": {
                    "request_id": str(boarding.id),
                    "pickup_stop": {"id": str(pickup_stop.id), "name": pickup_stop.name, "order": pickup_stop.order},
                    "dropoff_stop": {"id": str(dropoff_stop.id), "name": dropoff_stop.name, "order": dropoff_stop.order},
                    "route_name": active_trip.route.name,
                    "vehicle_number": active_trip.vehicle.vehicle_number,
                },
            }, status=status.HTTP_201_CREATED)
            return resp

        except Exception as e:
            logger.exception(f"[PassengerRaiseHand] Failed: {e}")
            return Response(
                {"success": False, "message": str(e)},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )

class RideLifecycleView(APIView):
    """
    POST /api/tracking/ride-lifecycle/
    Driver or system transitions a ride through states.

    Request:
        { "request_id": "<uuid>", "action": "accept"|"reject"|"board"|"complete" }
    """
    permission_classes = [IsAuthenticated]

    def post(self, request):
        serializer = RideLifecycleSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        request_id = serializer.validated_data["request_id"]
        action = serializer.validated_data["action"]

        process_ride_lifecycle.delay({
            "request_id": str(request_id),
            "action": action,
            "user_id": str(request.user.id),
        })

        resp = Response({
            "success": True,
            "message": f"Ride {action} dispatched",
            "data": {"request_id": str(request_id), "action": action},
        })
        return resp

# ──────────────────────────────────────────────────────────────
# Route info / stop list
# ──────────────────────────────────────────────────────────────

class RouteStopsView(APIView):
    """
    GET /api/tracking/route/<uuid:route_id>/stops/
    Returns the ordered stops for a route with cumulative distances.
    """
    permission_classes = [IsAuthenticated]

    def get(self, request, route_id):
        try:
            route = Route.objects.get(id=route_id)
        except Route.DoesNotExist:
            return Response(
                {"success": False, "message": "Route not found"},
                status=status.HTTP_404_NOT_FOUND,
            )

        stops = route.stops.order_by("order")
        resp = Response({
            "success": True,
            "data": RouteStopListSerializer(route).data,
        })
        return resp

class ActiveRouteTripsView(APIView):
    """
    GET /api/tracking/route/<uuid:route_id>/active-trips/
    Returns all active trips on a route with their cached Redis state.
    """
    permission_classes = [IsAuthenticated]

    def get(self, request, route_id):
        try:
            route = Route.objects.get(id=route_id)
        except Route.DoesNotExist:
            return Response(
                {"success": False, "message": "Route not found"},
                status=status.HTTP_404_NOT_FOUND,
            )

        trips = ActiveTrip.objects.filter(
            route=route, status=TRIP_STATUS_ACTIVE
        ).select_related("vehicle", "vehicle__driver", "current_stop")

        trip_data = []
        for trip in trips:
            state = RedisRouteService.get_vehicle_route_state(str(trip.vehicle_id))
            etas = RedisRouteService.get_vehicle_etas(str(trip.vehicle_id))
            trip_data.append({
                "trip_id": str(trip.id),
                "vehicle_id": str(trip.vehicle_id),
                "vehicle_number": trip.vehicle.vehicle_number,
                "driver_name": trip.vehicle.driver.username if trip.vehicle.driver else "",
                "direction": trip.direction,
                "current_stop": {
                    "id": str(trip.current_stop.id) if trip.current_stop else None,
                    "name": trip.current_stop.name if trip.current_stop else "",
                    "order": trip.current_stop.order if trip.current_stop else 0,
                },
                "current_segment_index": trip.current_segment_index,
                "eta_to_next_stop_s": state.get("eta_to_next_stop_s") if state else None,
                "downstream_etas": etas or {},
                "last_updated": trip.last_updated.isoformat(),
            })

        resp = Response({
            "success": True,
            "data": trip_data,
        })
        return resp

class NearbyRoutesView(APIView):
    """
    GET /api/tracking/nearby-routes/?lat=X&lng=Y&radius=2000
    Returns routes whose stops are within radius metres of the given point.
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        try:
            lat = float(request.query_params.get("lat", 0))
            lng = float(request.query_params.get("lng", 0))
            radius = int(request.query_params.get("radius", 2000))
        except (TypeError, ValueError):
            return Response(
                {"success": False, "message": "Invalid lat/lng/radius"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if not lat or not lng:
            return Response(
                {"success": False, "message": "lat and lng are required"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        from django.contrib.gis.geos import Point
        from django.contrib.gis.measure import D
        from django.db.models import Count, Q
        from tracking.services.geo_service import GeoService

        point = Point(lng, lat, srid=4326)
        stops_near = Stop.objects.filter(
            location__distance_lte=(point, D(m=radius))
        ).select_related("route").order_by("route_id")

        route_map = {}
        for stop in stops_near:
            rid = str(stop.route_id)
            if rid not in route_map:
                route_map[rid] = {
                    "route_id": rid,
                    "route_name": stop.route.name,
                    "route_code": stop.route.route_code,
                    "start_name": stop.route.start_name,
                    "end_name": stop.route.end_name,
                    "nearest_stop": None,
                    "nearest_distance_m": float("inf"),
                }
            dist_m = GeoService.haversine_m(
                lat, lng, stop.location.y, stop.location.x
            )
            if dist_m < route_map[rid]["nearest_distance_m"]:
                route_map[rid]["nearest_distance_m"] = round(dist_m, 1)
                route_map[rid]["nearest_stop"] = {
                    "id": str(stop.id),
                    "name": stop.name,
                    "order": stop.order,
                }

        # Add active trip counts in a single query (no N+1)
        if route_map:
            counts = (
                ActiveTrip.objects.filter(
                    route_id__in=route_map.keys(), status=TRIP_STATUS_ACTIVE
                )
                .values("route_id")
                .annotate(n=Count("id"))
            )
            count_by_route = {str(c["route_id"]): c["n"] for c in counts}
            for rid in route_map:
                route_map[rid]["active_trips"] = count_by_route.get(rid, 0)

        routes = sorted(route_map.values(), key=lambda r: r["nearest_distance_m"])

        resp = Response({
            "success": True,
            "data": routes,
        })
        return resp


# ──────────────────────────────────────────────────────────────
# Journeys — free-form driver trips (no fixed route)
# ──────────────────────────────────────────────────────────────


class StartJourneyAPIView(APIView):
    """
    POST /api/tracking/journeys/start/
    Driver declares where they are going.

    Request:
        {
            "vehicle_id": "<uuid>",
            "origin":      {"lat": 26.73, "lng": 80.85},
            "destination": {"lat": 26.87, "lng": 81.01},
            "origin_name": "Amausi",
            "destination_name": "Kamta High Court"
        }

    The server builds one direct OSRM road path between the endpoints and
    attaches the admin-managed global stops falling within the corridor around
    it, nearest-first from the origin. Both are held in Redis for the life of
    the journey.

    The path is mandatory: if OSRM cannot route between the two points the
    request fails rather than starting a journey that could not be driven,
    snapped to, or matched against stops.
    """

    permission_classes = [IsAuthenticated, IsDriver]

    def post(self, request):
        serializer = StartJourneySerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        data = serializer.validated_data
        result = JourneyService.start_journey(
            driver=request.user,
            vehicle_id=str(data["vehicle_id"]),
            origin=(data["origin"]["lat"], data["origin"]["lng"]),
            destination=(data["destination"]["lat"], data["destination"]["lng"]),
            origin_name=data.get("origin_name", ""),
            destination_name=data.get("destination_name", ""),
        )

        return Response(
            {
                "success": True,
                "message": f"Journey started with {len(result['stops'])} stop(s) on the way",
                "data": result,
            },
            status=status.HTTP_201_CREATED,
        )


class PreviewJourneyAPIView(APIView):
    """
    POST /api/tracking/journeys/preview/
    Resolve the road and its stops for a proposed journey, changing nothing.

    Request:
        {
            "origin":      {"lat": 26.73, "lng": 80.85},
            "destination": {"lat": 26.87, "lng": 81.01}
        }

    Returns the same path and ordered global stops that starting the journey
    would produce, so the driver can approve the actual road before it becomes a
    live trip. No ActiveTrip row, no Redis document, no vehicle state change -
    unlike /journeys/start/, this is safe to call on every edit.
    """

    permission_classes = [IsAuthenticated, IsDriver]

    def post(self, request):
        serializer = PreviewJourneySerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        data = serializer.validated_data
        result = JourneyService.preview_journey(
            driver=request.user,
            origin=(data["origin"]["lat"], data["origin"]["lng"]),
            destination=(data["destination"]["lat"], data["destination"]["lng"]),
        )

        return Response(
            {
                "success": True,
                "message": (
                    f"{len(result['stops'])} stop(s) on this road"
                    if result["stops"]
                    else "No global stops on this road"
                ),
                "data": result,
            }
        )


class EndJourneyAPIView(APIView):
    """
    POST /api/tracking/journeys/end/
    Driver finishes their journey: settles boarded passengers, frees the
    vehicle and drops the cached path and stop index.
    """

    permission_classes = [IsAuthenticated, IsDriver]

    def post(self, request):
        serializer = EndJourneySerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        result = JourneyService.end_journey(
            trip_id=str(serializer.validated_data["trip_id"]),
            user=request.user,
            cancel=serializer.validated_data.get("cancel", False),
        )

        return Response(
            {
                "success": True,
                "message": "Journey ended",
                "data": result,
            }
        )


class ActiveJourneyAPIView(APIView):
    """
    GET /api/tracking/journeys/active/
    The signed-in driver's in-progress journey, or null.

    Exists so the app can put a driver back on their journey without knowing the
    trip id — after a cold start the id was only ever in memory. Answers 200 with
    `data: null` when there is nothing to resume, which is the common case and
    must not be an error.
    """

    permission_classes = [IsAuthenticated, IsDriver]

    def get(self, request):
        journey = JourneyService.get_active_journey_for_driver(request.user)
        if not journey:
            return Response({"success": True, "data": None})
        return Response({"success": True, "data": journey})


class JourneyDetailAPIView(APIView):
    """
    GET /api/tracking/journeys/<trip_id>/
    The live journey: path, ordered stops and metrics. Used by the driver app
    to rehydrate after a refresh.
    """

    permission_classes = [IsAuthenticated, IsDriver]

    def get(self, request, trip_id):
        trip = ActiveTrip.objects.select_related("vehicle", "driver").filter(
            id=trip_id
        ).first()
        if not trip:
            return Response(
                {"success": False, "message": "Journey not found"},
                status=status.HTTP_404_NOT_FOUND,
            )
        if trip.driver_id != request.user.id:
            raise PermissionDenied("This journey belongs to another driver.")

        result = JourneyService.get_journey(str(trip.id))
        if not result:
            # The trip is a journey but its cached path is gone (Redis flush or
            # TTL). Say so plainly rather than returning an empty journey that
            # would render as a vehicle going nowhere.
            return Response(
                {
                    "success": False,
                    "message": "This journey's route is no longer available",
                    "data": {"trip_id": str(trip.id), "status": trip.status},
                },
                status=status.HTTP_410_GONE,
            )

        return Response({"success": True, "data": result})


class CorridorVehiclesAPIView(APIView):
    """
    POST /api/tracking/corridor/vehicles/
    Live vehicles running the corridor between the passenger's two points.

    This is the passenger-side counterpart to the journey preview: the same road
    is resolved, but instead of returning the geometry alone it returns the
    vehicles whose current journey serves a stop on that road and has not passed
    it yet - which is what the trip planner needs to answer "who can I get on
    for this route?".

    Read-only. No trip is created, no boarding is attached, and a driver who has
    already gone past the boarding stop is excluded because they can no longer
    serve it.
    """

    permission_classes = [IsAuthenticated, IsPassenger]

    def post(self, request):
        serializer = CorridorSearchSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        data = serializer.validated_data
        result = CorridorSearchService.find_vehicles(
            origin=(data["origin"]["lat"], data["origin"]["lng"]),
            destination=(data["destination"]["lat"], data["destination"]["lng"]),
            radius_m=data.get("radius", JOURNEY_CORRIDOR_RADIUS_M),
            limit=data.get("limit", 20),
        )

        if not result["resolved"]:
            return Response(
                {
                    "success": False,
                    "message": (
                        "Could not build a road route between these points. "
                        "Pick a point on a road and try again."
                    ),
                    "data": {"path": [], "stops": [], "vehicles": []},
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        return Response({"success": True, "data": result})


class PassingVehiclesAPIView(APIView):
    """
    GET /api/tracking/stops/<stop_id>/passing-vehicles/
    Vehicles whose current journey serves a stop — what a passenger standing at
    that stop sees before raising a hand.

    Only vehicles that have not yet passed the stop are returned: a vehicle
    beyond it cannot pick the passenger up, and showing it would offer a
    choice that cannot be taken.
    """

    permission_classes = [IsAuthenticated]

    def get(self, request, stop_id):
        stop = Stop.objects.filter(id=stop_id).first()
        if not stop:
            return Response(
                {"success": False, "message": "Stop not found"},
                status=status.HTTP_404_NOT_FOUND,
            )

        candidates = DispatchService.find_candidates_for_stop(
            str(stop.id), limit=10
        )

        vehicles = []
        for candidate in candidates:
            trip = candidate["trip"]
            vehicle_state = candidate["vehicle"].state
            journey = JourneyCacheService.get_journey(str(trip.id)) or {}
            vehicles.append({
                "trip_id": str(trip.id),
                "vehicle_id": str(candidate["vehicle"].id),
                "vehicle_number": candidate["vehicle"].vehicle_number,
                "vehicle_type": candidate["vehicle"].vehicle_type,
                "driver_id": str(candidate["driver"].id),
                "driver_name": _user_display_name(candidate["driver"]),
                "distance_km": candidate["distance"],
                "eta_minutes": CorridorService.eta_to_stop_s(str(trip.id), str(stop.id)),
                "lat": (
                    vehicle_state.current_location.y
                    if vehicle_state and vehicle_state.current_location
                    else None
                ),
                "lng": (
                    vehicle_state.current_location.x
                    if vehicle_state and vehicle_state.current_location
                    else None
                ),
                "destination": journey.get("destination"),
            })

        return Response({
            "success": True,
            "data": {
                "stop": {
                    "id": str(stop.id),
                    "name": stop.name,
                    "lat": stop.location.y,
                    "lng": stop.location.x,
                },
                "vehicles": vehicles,
                "count": len(vehicles),
            },
        })
