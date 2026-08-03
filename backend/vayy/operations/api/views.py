import logging
from rest_framework import status
from rest_framework.exceptions import (
    PermissionDenied,
    ValidationError,
)
from rest_framework.permissions import (
    IsAuthenticated,
)
from rest_framework.response import Response
from rest_framework.views import APIView

from accounts.permissions import (
    IsDriver,
    IsPassenger,
)
from operations.api.serializers import (
    ActiveTripSerializer,
    BoardingRequestCreateSerializer,
    BoardingRequestSerializer,
    StartTripSerializer,
    VehicleSerializer,
    VehicleStateSerializer,
    DispatchRequestSerializer,
    DispatchAssignSerializer,
    DispatchCancelSerializer,
    RideEstimateSerializer,
    RideEstimateResponseSerializer,
    TripRatingSerializer,
)
from operations.selectors.boarding_selector import (
    BoardingSelector,
)
from operations.selectors.trip_selector import (
    TripSelector,
)
from operations.selectors.vehicle_selector import (
    VehicleSelector,
)
from operations.services.boarding_service import (
    BoardingService,
)
from operations.services.trip_service import (
    TripService,
)
from operations.services.dispatch_service import (
    DispatchService,
)
from operations.services.ride_service import RideService
from operations.services.rating_service import RatingService
from transport.api.serializers import (
    StopTimeSerializer,
)
from transport.models import StopTime
from operations.models import ActiveTrip, DispatchRequest, VehicleState
from operations.constants import (
    TRIP_STATUS_REQUESTED,
    TRIP_STATUS_ACCEPTED,
    TRIP_STATUS_CANCELLED,
)
from django.utils import timezone
from channels.layers import get_channel_layer
from asgiref.sync import async_to_sync

logger = logging.getLogger(__name__)

class RideEstimateAPIView(APIView):
    """
    POST /api/ride/estimate
    Provides fare and duration estimates for a potential ride.
    """
    permission_classes = [IsAuthenticated, IsPassenger]

    def post(self, request):
        serializer = RideEstimateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        
        estimate = RideService.calculate_estimate(**serializer.validated_data)
        
        resp = Response({
            "success": True,
            "message": "Estimate calculated successfully",
            "data": RideEstimateResponseSerializer(estimate).data
        })
        return resp

class NearbyVehiclesAPIView(APIView):
    """
    GET /api/tracking/nearby
    Finds active vehicles near a location.
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
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

        vehicles = RideService.get_nearby_vehicles(lat, lng, radius, vehicle_type)
        
        resp = Response({
            "success": True,
            "message": f"Found {vehicles.count()} nearby vehicles",
            "data": VehicleStateSerializer(vehicles, many=True).data
        })
        return resp

class DispatchRequestAPIView(APIView):
    """
    POST /api/v1/dispatch/request
    Passenger requests a ride on a specific route.
    """
    permission_classes = [IsAuthenticated, IsPassenger]

    def post(self, request):
        serializer = DispatchRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        
        try:
            result = DispatchService.request_dispatch(
                passenger=request.user,
                route_id=str(serializer.validated_data["route_id"]),
                pickup_stop_id=str(serializer.validated_data["pickup_stop_id"]),
                mode=serializer.validated_data.get("mode", "direct")
            )
            resp = Response(result, status=status.HTTP_202_ACCEPTED)
            return resp
        except Exception as e:
            logger.exception("[DispatchRequest] Dispatch request failed")
            return Response({"detail": str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

class DispatchAssignAPIView(APIView):
    """
    POST /api/v1/dispatch/assign
    Admin or automated system assigns a driver/vehicle to a route.
    """
    permission_classes = [IsAuthenticated] # Should be IsAdmin/IsStaff in real app

    def post(self, request):
        serializer = DispatchAssignSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        
        try:
            trip = DispatchService.assign_trip(
                vehicle_id=str(serializer.validated_data["vehicle_id"]),
                driver_id=str(serializer.validated_data["driver_id"]),
                route_id=str(serializer.validated_data["route_id"]),
                trip_schedule_id=serializer.validated_data.get("trip_schedule_id")
            )
            resp = Response(ActiveTripSerializer(trip).data, status=status.HTTP_201_CREATED)
            return resp
        except ValueError as e:
            logger.warning(f"[DispatchAssign] Value error: {e}")
            return Response({"detail": str(e)}, status=status.HTTP_400_BAD_REQUEST)
        except Exception as e:
            logger.exception("[DispatchAssign] Dispatch assignment failed")
            return Response({"detail": "Internal server error"}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

class DispatchCancelAPIView(APIView):
    """
    POST /api/v1/dispatch/cancel
    Cancels an active dispatch/trip.
    """
    permission_classes = [IsAuthenticated]

    def post(self, request, trip_id):
        serializer = DispatchCancelSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        
        try:
            trip = DispatchService.cancel_dispatch(
                trip_id=trip_id,
                user=request.user,
                reason=serializer.validated_data["reason"]
            )
            resp = Response(ActiveTripSerializer(trip).data)
            return resp
        except Exception as e:
            logger.exception(f"[DispatchCancel] Cancellation failed for trip {trip_id}")
            return Response({"detail": str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

class DispatchDetailAPIView(APIView):
    """
    GET /api/v1/dispatch/{trip_id}
    Returns details of a dispatch assignment (ActiveTrip).
    """
    permission_classes = [IsAuthenticated]

    def get(self, request, trip_id):
        try:
            trip = TripSelector.get_trip(trip_id)
            resp = Response(ActiveTripSerializer(trip).data)
            return resp
        except ActiveTrip.DoesNotExist:
            logger.warning(f"[DispatchDetail] Trip {trip_id} not found")
            return Response({"detail": "Trip not found"}, status=status.HTTP_404_NOT_FOUND)

class DriverInitiateRideAPIView(APIView):
    """
    POST /api/operations/dispatch/initiate-ride/
    Driver initiates a ride request to a specific passenger.
    Creates an ActiveTrip in 'requested' state and notifies the passenger via WebSocket.
    """
    permission_classes = [IsAuthenticated, IsDriver]

    def post(self, request):
        passenger_id = request.data.get("passenger_id")
        route_id = request.data.get("route_id")
        pickup_stop_id = request.data.get("pickup_stop_id")

        if not all([passenger_id, route_id, pickup_stop_id]):
            return Response(
                {"success": False, "message": "passenger_id, route_id, and pickup_stop_id are required"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            driver = request.user
            passenger = User.objects.get(id=passenger_id)
            route = Route.objects.get(id=route_id)
            from transport.models import Stop
            pickup_stop = Stop.objects.get(id=pickup_stop_id)

            vehicle = VehicleSelector.get_driver_vehicle(driver.id)
            if not vehicle:
                return Response(
                    {"success": False, "message": "Driver has no assigned vehicle"},
                    status=status.HTTP_400_BAD_REQUEST,
                )

            trip = ActiveTrip.objects.create(
                vehicle=vehicle,
                route=route,
                driver=driver,
                status=TRIP_STATUS_REQUESTED,
                started_at=timezone.now(),
            )

            BoardingRequest.objects.create(
                passenger=passenger,
                trip=trip,
                pickup_stop=pickup_stop,
                status="pending",
            )

            payload = {
                "trip_id": str(trip.id),
                "passenger_id": str(passenger_id),
                "driver_id": str(driver.id),
                "driver_name": driver.get_full_name(),
                "route_id": route_id,
                "route_name": route.name,
                "pickup_stop_id": pickup_stop_id,
                "pickup_stop_name": pickup_stop.name,
                "vehicle_number": vehicle.vehicle_number,
                "vehicle_type": vehicle.vehicle_type,
                "status": trip.status,
                "requested_at": timezone.now().isoformat(),
            }

            channel_layer = get_channel_layer()
            async_to_sync(channel_layer.group_send)(
                f"dispatch_{trip.id}",
                {"type": "dispatch_update", "data": payload},
            )
            async_to_sync(channel_layer.group_send)(
                f"notifications_{passenger_id}",
                {
                    "type": "notification_broadcast",
                    "data": {
                        "title": "Ride Request",
                        "message": f"{driver.get_full_name()} wants to pick you up for {route.name}",
                        "trip_id": str(trip.id),
                        "type": "ride_request",
                        **payload,
                    },
                },
            )

            from operations.tasks import check_assignment_timeout
            check_assignment_timeout.apply_async((str(trip.id),), countdown=120)

            resp = Response(
                {
                    "success": True,
                    "message": "Ride request sent to passenger",
                    "data": {
                        "trip_id": str(trip.id),
                        "passenger_name": passenger.get_full_name(),
                        "status": trip.status,
                    },
                },
                status=status.HTTP_201_CREATED,
            )
            return resp

        except User.DoesNotExist:
            logger.warning(f"[DriverInitiateRide] Passenger {passenger_id} not found")
            return Response(
                {"success": False, "message": "Passenger not found"},
                status=status.HTTP_404_NOT_FOUND,
            )
        except Route.DoesNotExist:
            logger.warning(f"[DriverInitiateRide] Route {route_id} not found")
            return Response(
                {"success": False, "message": "Route not found"},
                status=status.HTTP_404_NOT_FOUND,
            )
        except Exception as e:
            logger.exception(f"[DriverInitiateRide] Driver initiate ride failed: {e}")
            return Response(
                {"success": False, "message": str(e)},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )

class PassengerAcceptRideAPIView(APIView):
    """
    PATCH /api/operations/dispatch/{trip_id}/passenger-accept/
    Passenger accepts a driver-initiated ride request.
    """
    permission_classes = [IsAuthenticated, IsPassenger]

    def patch(self, request, trip_id):
        try:
            trip = ActiveTrip.objects.get(id=trip_id)
            if trip.status != TRIP_STATUS_REQUESTED:
                return Response(
                    {"success": False, "message": f"Cannot accept trip in '{trip.status}' status"},
                    status=status.HTTP_400_BAD_REQUEST,
                )

            trip.status = TRIP_STATUS_ACCEPTED
            trip.save()

            payload = {
                "trip_id": str(trip.id),
                "status": trip.status,
                "updated_at": timezone.now().isoformat(),
            }

            channel_layer = get_channel_layer()
            async_to_sync(channel_layer.group_send)(
                f"dispatch_{trip.id}",
                {"type": "dispatch_update", "data": payload},
            )

            resp = Response({"success": True, "message": "Ride accepted", "data": payload})
            return resp

        except ActiveTrip.DoesNotExist:
            logger.warning(f"[PassengerAcceptRide] Trip {trip_id} not found")
            return Response({"success": False, "message": "Trip not found"}, status=status.HTTP_404_NOT_FOUND)
        except Exception as e:
            logger.exception(f"[PassengerAcceptRide] Passenger accept ride failed: {e}")
            return Response({"success": False, "message": str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

class PassengerRejectRideAPIView(APIView):
    """
    PATCH /api/operations/dispatch/{trip_id}/passenger-reject/
    Passenger rejects a driver-initiated ride request.
    """
    permission_classes = [IsAuthenticated, IsPassenger]

    def patch(self, request, trip_id):
        try:
            trip = ActiveTrip.objects.get(id=trip_id)
            if trip.status != TRIP_STATUS_REQUESTED:
                return Response(
                    {"success": False, "message": f"Cannot reject trip in '{trip.status}' status"},
                    status=status.HTTP_400_BAD_REQUEST,
                )

            trip.status = TRIP_STATUS_CANCELLED
            trip.ended_at = timezone.now()
            trip.save()

            state, _ = VehicleState.objects.get_or_create(vehicle=trip.vehicle)
            state.active_trip = None
            state.save()

            payload = {
                "trip_id": str(trip.id),
                "status": trip.status,
                "updated_at": timezone.now().isoformat(),
            }

            channel_layer = get_channel_layer()
            async_to_sync(channel_layer.group_send)(
                f"dispatch_{trip.id}",
                {"type": "dispatch_update", "data": payload},
            )

            resp = Response({"success": True, "message": "Ride rejected", "data": payload})
            return resp

        except ActiveTrip.DoesNotExist:
            logger.warning(f"[PassengerRejectRide] Trip {trip_id} not found")
            return Response({"success": False, "message": "Trip not found"}, status=status.HTTP_404_NOT_FOUND)
        except Exception as e:
            logger.exception(f"[PassengerRejectRide] Passenger reject ride failed: {e}")
            return Response({"success": False, "message": str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

DRIVER_ROLES = [
    "driver",
    "bikedriver",
    "autodriver",
]

class VehicleListAPIView(APIView):
    permission_classes = [
        IsAuthenticated
    ]

    def get(self, request):
        city_id = request.query_params.get(
            "city_id"
        )
        route_id = request.query_params.get(
            "route_id"
        )

        if city_id:
            vehicles = (
                VehicleSelector
                .list_city_vehicles(city_id)
            )
        elif route_id:
            vehicles = (
                VehicleSelector
                .list_route_vehicles(route_id)
            )
        else:
            vehicles = (
                VehicleSelector
                .active_vehicles()
            )

        serializer = VehicleSerializer(
            vehicles,
            many=True,
        )

        resp = Response(serializer.data)
        return resp

class DriverVehicleAPIView(APIView):
    permission_classes = [
        IsAuthenticated,
        IsDriver,
    ]

    def get(self, request):
        vehicle = (
            VehicleSelector
            .get_driver_vehicle(
                request.user.id
            )
        )

        if not vehicle:
            logger.warning(f"[DriverVehicle] No vehicle for driver {request.user.id}")
            return Response(
                {
                    "detail": (
                        "No active vehicle assigned "
                        "to this driver."
                    )
                },
                status=status.HTTP_404_NOT_FOUND,
            )

        resp = Response(
            VehicleSerializer(vehicle).data
        )
        return resp

class VehicleDetailAPIView(APIView):
    permission_classes = [
        IsAuthenticated
    ]

    def get(
        self,
        request,
        vehicle_id,
    ):
        vehicle = (
            VehicleSelector
            .get_vehicle(vehicle_id)
        )

        resp = Response(
            VehicleSerializer(vehicle).data
        )
        return resp

class VehicleStateAPIView(APIView):
    permission_classes = [
        IsAuthenticated
    ]

    def get(
        self,
        request,
        vehicle_id,
    ):
        vehicle = (
            VehicleSelector
            .get_vehicle(vehicle_id)
        )
        state = getattr(
            vehicle,
            "state",
            None,
        )

        if not state:
            logger.warning(f"[VehicleState] No state for vehicle {vehicle_id}")
            return Response(
                {
                    "detail": (
                        "Vehicle state unavailable."
                    )
                },
                status=status.HTTP_404_NOT_FOUND,
            )

        resp = Response(
            VehicleStateSerializer(state).data
        )
        return resp

class ActiveTripListAPIView(APIView):
    permission_classes = [
        IsAuthenticated
    ]

    def get(self, request):
        city_id = request.query_params.get(
            "city_id"
        )
        route_id = request.query_params.get(
            "route_id"
        )

        if city_id:
            trips = (
                TripSelector
                .list_city_active_trips(city_id)
            )
        elif route_id:
            trips = (
                TripSelector
                .list_route_trips(route_id)
            )
        else:
            trips = (
                TripSelector
                .list_active_trips()
            )

        serializer = ActiveTripSerializer(
            trips,
            many=True,
        )

        resp = Response(serializer.data)
        return resp

class ActiveTripDetailAPIView(APIView):
    permission_classes = [
        IsAuthenticated
    ]

    def get(
        self,
        request,
        trip_id,
    ):
        trip = TripSelector.get_trip(
            trip_id
        )

        resp = Response(
            ActiveTripSerializer(trip).data
        )
        return resp

class DriverActiveTripAPIView(APIView):
    permission_classes = [
        IsAuthenticated,
        IsDriver,
    ]

    def get(self, request):
        trip = (
            TripSelector
            .get_driver_active_trip(
                request.user.id
            )
        )

        if not trip:
            logger.info(f"[DriverActiveTrip] No active trip for driver {request.user.id}")
            return Response(
                {
                    "detail": (
                        "No active trip found "
                        "for this driver."
                    )
                },
                status=status.HTTP_404_NOT_FOUND,
            )

        resp = Response(
            ActiveTripSerializer(trip).data
        )
        return resp

class StartTripAPIView(APIView):
    permission_classes = [
        IsAuthenticated,
        IsDriver,
    ]

    def post(self, request):
        serializer = StartTripSerializer(
            data=request.data
        )
        serializer.is_valid(
            raise_exception=True
        )

        vehicle = self._get_vehicle(
            request.user,
            serializer.validated_data.get(
                "vehicle_id"
            ),
        )

        try:
            trip = TripService.start_trip(
                vehicle=vehicle,
                route=serializer.validated_data[
                    "route"
                ],
                driver=request.user,
                trip_schedule=(
                    serializer.validated_data
                    .get("trip_schedule")
                ),
            )
        except ValueError as exc:
            raise ValidationError(
                str(exc)
            ) from exc

        resp = Response(
            ActiveTripSerializer(trip).data,
            status=status.HTTP_201_CREATED,
        )
        return resp

    def _get_vehicle(
        self,
        user,
        vehicle_id=None,
    ):
        if vehicle_id:
            vehicle = (
                VehicleSelector
                .get_vehicle(vehicle_id)
            )
            if vehicle.driver_id != user.id:
                raise PermissionDenied(
                    "Vehicle is not assigned "
                    "to this driver."
                )
            return vehicle

        vehicle = (
            VehicleSelector
            .get_driver_vehicle(user.id)
        )
        if not vehicle:
            raise ValidationError(
                "Driver has no assigned vehicle."
            )

        return vehicle

class DispatchAcceptAPIView(APIView):
    """
    PATCH /api/dispatch/{id}/accept
    Driver accepts the assignment.
    """
    permission_classes = [IsAuthenticated, IsDriver]

    def patch(self, request, trip_id):
        try:
            trip = DispatchService.accept_assignment(trip_id, request.user)
            resp = Response({
                "success": True,
                "message": "Assignment accepted",
                "data": ActiveTripSerializer(trip).data
            })
            return resp
        except Exception as e:
            logger.exception(f"[DispatchAccept] Failed for trip {trip_id}")
            return Response({"success": False, "message": str(e)}, status=status.HTTP_400_BAD_REQUEST)

class DispatchRejectAPIView(APIView):
    """
    PATCH /api/dispatch/{id}/reject
    Driver rejects the assignment.
    """
    permission_classes = [IsAuthenticated, IsDriver]

    def patch(self, request, trip_id):
        try:
            trip = DispatchService.reject_assignment(trip_id, request.user)
            resp = Response({
                "success": True,
                "message": "Assignment rejected",
                "data": ActiveTripSerializer(trip).data
            })
            return resp
        except Exception as e:
            logger.exception(f"[DispatchReject] Failed for trip {trip_id}")
            return Response({"success": False, "message": str(e)}, status=status.HTTP_400_BAD_REQUEST)

class DispatchArrivedAPIView(APIView):
    """
    PATCH /api/dispatch/{id}/arrived
    Driver arrived at pickup location.
    """
    permission_classes = [IsAuthenticated, IsDriver]

    def patch(self, request, trip_id):
        try:
            trip = DispatchService.arrived_at_pickup(trip_id, request.user)
            resp = Response({
                "success": True,
                "message": "Driver arrived at pickup",
                "data": ActiveTripSerializer(trip).data
            })
            return resp
        except Exception as e:
            logger.exception(f"[DispatchArrived] Failed for trip {trip_id}")
            return Response({"success": False, "message": str(e)}, status=status.HTTP_400_BAD_REQUEST)

class DispatchStartAPIView(APIView):
    """
    PATCH /api/dispatch/{id}/start
    Driver starts the trip after OTP verification.
    """
    permission_classes = [IsAuthenticated, IsDriver]

    def patch(self, request, trip_id):
        try:
            otp = request.data.get("otp")
            trip = DispatchService.start_trip(trip_id, request.user, otp=otp)
            resp = Response({
                "success": True,
                "message": "Trip started",
                "data": ActiveTripSerializer(trip).data
            })
            return resp
        except Exception as e:
            logger.exception(f"[DispatchStart] Failed for trip {trip_id}")
            return Response({"success": False, "message": str(e)}, status=status.HTTP_400_BAD_REQUEST)

class DispatchCompleteAPIView(APIView):
    """
    PATCH /api/dispatch/{id}/complete
    Driver or passenger completes the trip.
    """
    permission_classes = [IsAuthenticated]

    def patch(self, request, trip_id):
        try:
            trip = DispatchService.complete_trip(trip_id, request.user)
            resp = Response({
                "success": True,
                "message": "Trip completed",
                "data": ActiveTripSerializer(trip).data
            })
            return resp
        except Exception as e:
            logger.exception(f"[DispatchComplete] Failed for trip {trip_id}")
            return Response({"success": False, "message": str(e)}, status=status.HTTP_400_BAD_REQUEST)

class TripNextStopsAPIView(APIView):
    permission_classes = [
        IsAuthenticated
    ]

    def get(
        self,
        request,
        trip_id,
    ):
        trip = TripSelector.get_trip(
            trip_id
        )

        if not trip.trip_schedule_id:
            logger.info(f"[TripNextStops] Trip {trip_id} has no schedule")
            return Response([])

        stop_times = (
            StopTime.objects
            .filter(
                trip_schedule=trip.trip_schedule
            )
            .select_related("stop")
            .order_by("stop_sequence")
        )

        resp = Response(
            StopTimeSerializer(
                stop_times,
                many=True,
            ).data
        )
        return resp

class TripBoardingRequestListAPIView(APIView):
    permission_classes = [
        IsAuthenticated,
        IsDriver,
    ]

    def get(
        self,
        request,
        trip_id,
    ):
        trip = TripSelector.get_trip(
            trip_id
        )
        if trip.driver_id != request.user.id:
            raise PermissionDenied(
                "Trip is not assigned "
                "to this driver."
            )

        requests = (
            BoardingSelector
            .list_trip_requests(trip_id)
        )

        resp = Response(
            BoardingRequestSerializer(
                requests,
                many=True,
            ).data
        )
        return resp

class BoardingRequestListAPIView(APIView):
    permission_classes = [
        IsAuthenticated,
        IsPassenger,
    ]

    def get(self, request):
        requests = (
            BoardingSelector
            .list_passenger_requests(
                request.user.id
            )
        )

        serializer = BoardingRequestSerializer(
            requests,
            many=True,
        )

        resp = Response(serializer.data)
        return resp

    def post(self, request):
        serializer = (
            BoardingRequestCreateSerializer(
                data=request.data
            )
        )
        serializer.is_valid(
            raise_exception=True
        )

        logger.info(
            f"[BoardingRequestList(POST)] Validated data: "
            f"trip_id={serializer.validated_data['trip'].id} "
            f"pickup_stop_id={serializer.validated_data['pickup_stop'].id} "
            f"pickup_stop_name={serializer.validated_data['pickup_stop'].name}"
        )

        boarding_request = (
            BoardingService
            .create_request(
                passenger=request.user,
                trip=serializer.validated_data[
                    "trip"
                ],
                pickup_stop=serializer.validated_data[
                    "pickup_stop"
                ],
            )
        )

        resp = Response(
            BoardingRequestSerializer(
                boarding_request
            ).data,
            status=status.HTTP_201_CREATED,
        )
        return resp

class BoardingRequestDetailAPIView(APIView):
    permission_classes = [
        IsAuthenticated
    ]

    def get(
        self,
        request,
        request_id,
    ):
        boarding_request = (
            BoardingSelector
            .get_request(request_id)
        )
        self._check_access(
            request.user,
            boarding_request,
        )

        resp = Response(
            BoardingRequestSerializer(
                boarding_request
            ).data
        )
        return resp

    def delete(
        self,
        request,
        request_id,
    ):
        boarding_request = (
            BoardingSelector
            .get_request(request_id)
        )
        if (
            boarding_request.passenger_id
            != request.user.id
        ):
            raise PermissionDenied(
                "Only the passenger can cancel "
                "this request."
            )

        boarding_request = (
            BoardingService
            .cancel_request(request_id)
        )

        resp = Response(
            BoardingRequestSerializer(
                boarding_request
            ).data
        )
        return resp

    def _check_access(
        self,
        user,
        boarding_request,
    ):
        if boarding_request.passenger_id == user.id:
            return

        if (
            user.role in DRIVER_ROLES
            and boarding_request.trip.driver_id == user.id
        ):
            return

        raise PermissionDenied(
            "You do not have access "
            "to this request."
        )

class BoardingRequestBoardedAPIView(APIView):
    permission_classes = [
        IsAuthenticated,
        IsDriver,
    ]

    def post(
        self,
        request,
        request_id,
    ):
        boarding_request = (
            BoardingSelector
            .get_request(request_id)
        )

        if boarding_request.trip.driver_id != request.user.id:
            raise PermissionDenied(
                "Trip is not assigned "
                "to this driver."
            )

        boarding_request = (
            BoardingService
            .mark_boarded(request_id)
        )

        resp = Response(
            BoardingRequestSerializer(
                boarding_request
            ).data
        )
        return resp

class TripRatingAPIView(APIView):
    """
    POST /api/ride/rating
    Allows passengers to rate a completed trip.
    """
    permission_classes = [IsAuthenticated, IsPassenger]

    def post(self, request):
        serializer = TripRatingSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        
        try:
            rating = RatingService.rate_trip(
                trip_id=str(serializer.validated_data["trip"].id),
                passenger=request.user,
                rating=serializer.validated_data["rating"],
                review=serializer.validated_data.get("review", "")
            )
            resp = Response(TripRatingSerializer(rating).data, status=status.HTTP_201_CREATED)
            return resp
        except Exception as e:
            logger.exception("[TripRating] Rating failed")
            return Response({"detail": str(e)}, status=status.HTTP_400_BAD_REQUEST)

class TripHistoryAPIView(APIView):
    """
    GET /api/ride/history
    Returns past trips for the authenticated user.
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        from django.db.models import Q
        
        user = request.user
        query = Q(driver=user) | Q(boarding_requests__passenger=user)
        
        status_filter = request.query_params.get("status")
        if status_filter:
            query &= Q(status=status_filter)
        else:
            query &= Q(status__in=["completed", "cancelled"])

        trips = ActiveTrip.objects.filter(query).distinct().order_by("-started_at")
        
        # Simple pagination
        page = int(request.query_params.get("page", 1))
        page_size = int(request.query_params.get("page_size", 20))
        start = (page - 1) * page_size
        end = start + page_size
        
        serializer = ActiveTripSerializer(trips[start:end], many=True)
        resp = Response({
            "count": trips.count(),
            "results": serializer.data
        })
        return resp

class DriverEarningsAPIView(APIView):
    """
    GET /api/ride/earnings/
    Returns aggregated earnings for the authenticated driver.
    """
    permission_classes = [IsAuthenticated, IsDriver]

    def get(self, request):
        from datetime import timedelta
        from django.utils import timezone
        from operations.services.ride_service import RideService

        user = request.user
        period = request.query_params.get("period", "all")  # all, today, week, month

        trips = ActiveTrip.objects.filter(
            driver=user,
            status="completed",
        ).select_related("route", "vehicle").order_by("-ended_at")

        now = timezone.now()
        if period == "today":
            trips = trips.filter(ended_at__date=now.date())
        elif period == "week":
            trips = trips.filter(ended_at__gte=now - timedelta(days=7))
        elif period == "month":
            trips = trips.filter(ended_at__gte=now - timedelta(days=30))

        trip_list = []
        total_earnings = 0
        total_distance = 0
        total_duration = 0

        for trip in trips:
            fare = RideService.calculate_final_fare(trip)
            distance_km = trip.route.total_distance_meters / 1000.0 if trip.route else 0
            duration_min = 0
            if trip.started_at and trip.ended_at:
                duration_min = (trip.ended_at - trip.started_at).total_seconds() / 60.0

            total_earnings += fare
            total_distance += distance_km
            total_duration += duration_min

            trip_list.append({
                "id": str(trip.id),
                "route_name": trip.route.name if trip.route else "",
                "vehicle_type": trip.vehicle.vehicle_type if trip.vehicle else "",
                "distance_km": round(distance_km, 2),
                "duration_minutes": round(duration_min, 1),
                "fare": round(fare, 2),
                "started_at": trip.started_at.isoformat() if trip.started_at else None,
                "ended_at": trip.ended_at.isoformat() if trip.ended_at else None,
            })

        logger.info(
            f"[DriverEarnings] Driver {user.id} period={period} "
            f"trips={len(trip_list)} total_earnings={total_earnings}"
        )
        resp = Response({
            "total_earnings": round(total_earnings, 2),
            "total_trips": len(trip_list),
            "total_distance_km": round(total_distance, 2),
            "total_duration_minutes": round(total_duration, 1),
            "period": period,
            "trips": trip_list,
        })
        return resp

class BroadcastAcceptAPIView(APIView):
    """
    POST /api/operations/dispatch/broadcast/<request_id>/accept/
    Driver accepts a broadcast dispatch request.
    First driver to accept wins; others get dismissed via WS.
    """
    permission_classes = [IsAuthenticated, IsDriver]

    def post(self, request, request_id):
        try:
            result = DispatchService.accept_broadcast_request(str(request_id), request.user)
            status_code = status.HTTP_200_OK if result["status"] == "accepted" else status.HTTP_202_ACCEPTED
            resp = Response(result, status=status_code)
            return resp
        except DispatchRequest.DoesNotExist:
            return Response(
                {"status": "not_found", "message": "Dispatch request not found"},
                status=status.HTTP_404_NOT_FOUND,
            )
        except Exception as e:
            logger.exception(f"[BroadcastAccept] Failed for request {request_id}")
            return Response({"detail": str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

class BroadcastRejectAPIView(APIView):
    """
    POST /api/operations/dispatch/broadcast/<request_id>/reject/
    Driver dismisses a broadcast dispatch request (skip).
    """
    permission_classes = [IsAuthenticated, IsDriver]

    def post(self, request, request_id):
        try:
            result = DispatchService.dismiss_broadcast_request(str(request_id), request.user)
            resp = Response(result)
            return resp
        except Exception as e:
            logger.exception(f"[BroadcastReject] Failed for request {request_id}")
            return Response({"detail": str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

class BroadcastCancelAPIView(APIView):
    """
    POST /api/operations/dispatch/broadcast/<request_id>/cancel/
    Passenger cancels their broadcast dispatch request.
    """
    permission_classes = [IsAuthenticated, IsPassenger]

    def post(self, request, request_id):
        try:
            result = DispatchService.cancel_broadcast_request(str(request_id), request.user)
            resp = Response(result)
            return resp
        except DispatchRequest.DoesNotExist:
            return Response(
                {"status": "not_found", "message": "Dispatch request not found"},
                status=status.HTTP_404_NOT_FOUND,
            )
        except Exception as e:
            logger.exception(f"[BroadcastCancel] Failed for request {request_id}")
            return Response({"detail": str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class TripFareDetailAPIView(APIView):
    """
    GET /api/ride/trip/<trip_id>/fare/
    Returns fare breakdown for a completed/active trip.
    """
    permission_classes = [IsAuthenticated]

    def get(self, request, trip_id):
        from operations.services.ride_service import RideService

        try:
            trip = ActiveTrip.objects.get(id=trip_id)
        except ActiveTrip.DoesNotExist:
            return Response({"detail": "Trip not found"}, status=status.HTTP_404_NOT_FOUND)

        # If trip has stored fare, use it
        if trip.total_fare is not None:
            return Response({
                "success": True,
                "data": {
                    "distance_km": round(trip.total_distance_m / 1000, 2) if trip.total_distance_m else 0,
                    "duration_min": round(trip.total_duration_s / 60, 1) if trip.total_duration_s else 0,
                    "total_fare": float(trip.total_fare),
                }
            })

        # Otherwise calculate from route or estimate
        route = trip.route
        if route and route.total_distance_meters:
            dist_km = route.total_distance_meters / 1000
            dur_min = (dist_km / 25) * 60
            vehicle_type = trip.vehicle.vehicle_type if trip.vehicle else "bike"
            base_fare = 20 if vehicle_type == "bike" else 30
            per_km = 5 if vehicle_type == "bike" else 10
            total_fare = base_fare + (dist_km * per_km)
            return Response({
                "success": True,
                "data": {
                    "distance_km": round(dist_km, 2),
                    "duration_min": round(dur_min, 1),
                    "base_fare": base_fare,
                    "per_km_charge": per_km,
                    "total_fare": round(total_fare, 2),
                }
            })

        return Response(
            {"success": False, "message": "Fare data not available"},
            status=status.HTTP_404_NOT_FOUND,
        )
