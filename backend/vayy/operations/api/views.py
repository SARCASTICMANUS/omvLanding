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
                drop_stop_id=str(serializer.validated_data["drop_stop_id"]) if serializer.validated_data.get("drop_stop_id") else None,
                mode=serializer.validated_data.get("mode", "broadcast")
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
            vehicles[:200],
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
        try:
            vehicle = (
                VehicleSelector
                .get_vehicle(vehicle_id)
            )
        except Exception:
            logger.warning(f"[VehicleDetail] Vehicle {vehicle_id} not found")
            return Response(
                {"detail": "Vehicle not found"},
                status=status.HTTP_404_NOT_FOUND,
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
        try:
            vehicle = (
                VehicleSelector
                .get_vehicle(vehicle_id)
            )
        except Exception:
            logger.warning(f"[VehicleState] Vehicle {vehicle_id} not found")
            return Response(
                {"detail": "Vehicle not found"},
                status=status.HTTP_404_NOT_FOUND,
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
            trips[:200],
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
        try:
            trip = TripSelector.get_trip(
                trip_id
            )
        except Exception:
            logger.warning(f"[TripDetail] Trip {trip_id} not found")
            return Response(
                {"detail": "Trip not found"},
                status=status.HTTP_404_NOT_FOUND,
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
    Only the assigned driver or a passenger on the trip can complete it.
    """
    permission_classes = [IsAuthenticated]

    def patch(self, request, trip_id):
        try:
            trip = ActiveTrip.objects.get(id=trip_id)
        except ActiveTrip.DoesNotExist:
            return Response(
                {"success": False, "message": "Trip not found"},
                status=status.HTTP_404_NOT_FOUND,
            )

        # Authorization: only driver or passenger on this trip
        is_driver = trip.driver_id == request.user.id
        is_passenger = trip.boarding_requests.filter(
            passenger_id=request.user.id
        ).exists()
        if not is_driver and not is_passenger:
            return Response(
                {"success": False, "message": "You are not authorized to complete this trip"},
                status=status.HTTP_403_FORBIDDEN,
            )

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
                drop_stop=serializer.validated_data.get(
                    "drop_stop"
                ),
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
        from operations.services.fare_service import FareService
        from operations.services.ride_service import RideService
        from operations.models import BoardingRequest

        try:
            trip = ActiveTrip.objects.get(id=trip_id)
        except ActiveTrip.DoesNotExist:
            return Response({"detail": "Trip not found"}, status=status.HTTP_404_NOT_FOUND)

        vehicle_type = trip.vehicle.vehicle_type if trip.vehicle else "bike"

        # Try to find the passenger's boarding request for per-passenger fare
        boarding_request = BoardingRequest.objects.filter(
            trip=trip, passenger=request.user
        ).first()

        if boarding_request and boarding_request.pickup_stop and boarding_request.drop_stop:
            # Calculate per-passenger fare
            fare = RideService.calculate_segment_fare(
                boarding_request.pickup_stop, boarding_request.drop_stop, vehicle_type
            )
            # Get distance for breakdown
            pickup_lat = boarding_request.pickup_stop.location.y
            pickup_lng = boarding_request.pickup_stop.location.x
            drop_lat = boarding_request.drop_stop.location.y
            drop_lng = boarding_request.drop_stop.location.x
            estimate = RideService.calculate_estimate(pickup_lat, pickup_lng, drop_lat, drop_lng, vehicle_type)
            dist_km = estimate.get("distance_km", 0)
            dur_min = estimate.get("duration_minutes", 0)
            breakdown = FareService.calculate_fare_breakdown(dist_km, vehicle_type, dur_min)
            breakdown["total_fare"] = fare
            return Response({
                "success": True,
                "data": breakdown,
            })

        # Fallback: route-level fare (for driver view or if no boarding request)
        if trip.total_fare is not None:
            dist_km = round(trip.total_distance_m / 1000, 2) if trip.total_distance_m else 0
            dur_min = round(trip.total_duration_s / 60, 1) if trip.total_duration_s else None
            breakdown = FareService.calculate_fare_breakdown(dist_km, vehicle_type, dur_min)
            breakdown["total_fare"] = float(trip.total_fare)
            return Response({
                "success": True,
                "data": breakdown,
            })

        # Otherwise calculate from route
        route = trip.route
        if route and route.total_distance_meters:
            dist_km = route.total_distance_meters / 1000
            dur_min = (dist_km / 25) * 60
            breakdown = FareService.calculate_fare_breakdown(dist_km, vehicle_type, dur_min)
            return Response({
                "success": True,
                "data": breakdown,
            })

        return Response(
            {"success": False, "message": "Fare data not available"},
            status=status.HTTP_404_NOT_FOUND,
        )


# ──────────────────────────────────────────────────
# VEHICLE REGISTRATION (Driver self-registration)
# ──────────────────────────────────────────────────

class VehicleRegistrationAPIView(APIView):
    """
    POST /api/operations/vehicles/register/
    Allows a driver to register their vehicle during onboarding.
    Creates Vehicle with status=pending_approval.
    """
    permission_classes = [IsAuthenticated, IsDriver]

    def post(self, request):
        from operations.models import Vehicle
        from operations.constants import VEHICLE_STATUS_PENDING

        vehicle_number = request.data.get("vehicle_number", "").strip().upper()
        vehicle_type = request.data.get("vehicle_type", "").strip()

        if not vehicle_number:
            return Response(
                {"success": False, "message": "vehicle_number is required"},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if vehicle_type not in ("bike", "auto"):
            return Response(
                {"success": False, "message": "vehicle_type must be 'bike' or 'auto'"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Check if vehicle_number is taken by another driver
        existing = Vehicle.objects.filter(vehicle_number=vehicle_number).first()
        if existing and existing.driver != request.user:
            return Response(
                {"success": False, "message": "Vehicle with this number already exists"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # If driver already has a vehicle, update it; otherwise create new
        vehicle, created = Vehicle.objects.update_or_create(
            driver=request.user,
            defaults={
                "vehicle_number": vehicle_number,
                "vehicle_type": vehicle_type,
                "status": VEHICLE_STATUS_PENDING,
                "is_active": False,
            },
        )

        # Also update driver profile with vehicle info
        from accounts.models import PublicDriverProfile
        profile, _ = PublicDriverProfile.objects.get_or_create(user=request.user)
        profile.vehicle_number = vehicle_number
        profile.vehicle_type = vehicle_type
        profile.save(update_fields=["vehicle_number", "vehicle_type"])

        return Response(
            {
                "success": True,
                "message": "Vehicle registered, pending approval" if created else "Vehicle updated, pending approval",
                "data": VehicleSerializer(vehicle).data,
            },
            status=status.HTTP_201_CREATED if created else status.HTTP_200_OK,
        )


# ──────────────────────────────────────────────────
# ADMIN: Driver Verification
# ──────────────────────────────────────────────────

from accounts.models import DriverDocument, PublicDriverProfile, User
from accounts.api.serializers import DriverDocumentSerializer
from rest_framework.permissions import BasePermission


class IsAdminUser(BasePermission):
    def has_permission(self, request, view):
        return request.user and request.user.is_authenticated and (
            request.user.role == "admin" or request.user.is_staff
        )


class AdminPendingDriversAPIView(APIView):
    """
    GET /api/operations/admin/drivers/pending/
    Returns drivers with pending vehicle approval (pending_approval status).
    """
    permission_classes = [IsAuthenticated, IsAdminUser]

    def get(self, request):
        from operations.models import Vehicle

        # Get drivers whose vehicle is pending admin approval
        pending_vehicles = Vehicle.objects.filter(
            status="pending_approval",
        ).select_related("driver", "driver__driver_profile")

        result = []
        seen_driver_ids = set()
        for vehicle in pending_vehicles:
            driver = vehicle.driver
            if not driver or driver.id in seen_driver_ids:
                continue
            seen_driver_ids.add(driver.id)

            profile = getattr(driver, "driver_profile", None)
            docs = DriverDocument.objects.filter(driver=driver)

            result.append({
                "id": str(driver.id),
                "email": driver.email,
                "first_name": driver.first_name,
                "last_name": driver.last_name,
                "role": driver.role,
                "is_verified": profile.is_verified if profile else False,
                "date_joined": driver.date_joined.isoformat() if driver.date_joined else None,
                "profile": {
                    "display_name": getattr(profile, "display_name", None),
                    "phone_number": getattr(profile, "phone_number", None),
                    "license_number": getattr(profile, "license_number", None),
                    "vehicle_number": getattr(profile, "vehicle_number", None),
                    "vehicle_type": getattr(profile, "vehicle_type", None),
                } if profile else None,
                "vehicle": {
                    "id": str(vehicle.id),
                    "vehicle_number": vehicle.vehicle_number,
                    "vehicle_type": vehicle.vehicle_type,
                    "status": vehicle.status,
                } if vehicle else None,
                "documents": DriverDocumentSerializer(docs, many=True).data,
            })

        return Response(
            {
                "success": True,
                "data": result,
            }
        )


class AdminDriverVerifyAPIView(APIView):
    """
    PATCH /api/operations/admin/drivers/<uuid:driver_id>/verify/
    Approve or reject a driver.
    Body: { "action": "approve" | "reject" }
    """
    permission_classes = [IsAuthenticated, IsAdminUser]

    def patch(self, request, driver_id):
        from operations.models import Vehicle

        action = request.data.get("action")
        if action not in ("approve", "reject"):
            return Response(
                {"success": False, "message": "action must be 'approve' or 'reject'"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            driver = User.objects.get(id=driver_id)
        except User.DoesNotExist:
            return Response(
                {"success": False, "message": "Driver not found"},
                status=status.HTTP_404_NOT_FOUND,
            )

        if action == "approve":
            # Mark driver profile as verified
            try:
                profile = driver.driver_profile
                profile.is_verified = True
                profile.save(update_fields=["is_verified"])
            except Exception:
                pass

            # Approve vehicle too
            Vehicle.objects.filter(driver=driver).update(
                status="approved",
                is_active=True,
            )

            # Mark all documents as verified
            DriverDocument.objects.filter(driver=driver, status="pending").update(
                status="verified",
                verified_by=request.user,
                verified_at=timezone.now(),
            )

            # Send notification
            try:
                from communication.services.notification_service import NotificationService
                NotificationService.create(
                    user=driver,
                    title="Account Approved",
                    message="Congratulations! Your driver account has been verified. You can now start receiving trips.",
                    metadata={"event": "driver_verified"},
                )
            except Exception:
                pass

            message = "Driver approved"
        else:
            # Reject: mark vehicle as rejected
            Vehicle.objects.filter(driver=driver).update(status="rejected")
            message = "Driver rejected"

        return Response(
            {"success": True, "message": message},
        )


class AdminDocumentVerifyAPIView(APIView):
    """
    PATCH /api/operations/admin/documents/<uuid:doc_id>/verify/
    Approve or reject a single document.
    Body: { "action": "approve" | "reject", "rejection_reason": "..." }
    """
    permission_classes = [IsAuthenticated, IsAdminUser]

    def patch(self, request, doc_id):
        action = request.data.get("action")
        if action not in ("approve", "reject"):
            return Response(
                {"success": False, "message": "action must be 'approve' or 'reject'"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            doc = DriverDocument.objects.get(id=doc_id)
        except DriverDocument.DoesNotExist:
            return Response(
                {"success": False, "message": "Document not found"},
                status=status.HTTP_404_NOT_FOUND,
            )

        if action == "approve":
            doc.status = "verified"
            doc.verified_by = request.user
            doc.verified_at = timezone.now()
            doc.rejection_reason = ""
            doc.save(update_fields=["status", "rejection_reason", "verified_by", "verified_at"])

            # Auto-verify profile if all required docs are now verified
            from accounts.services.verification_service import VerificationService
            VerificationService.check_and_verify_profile(doc.driver)
        else:
            doc.status = "rejected"
            doc.rejection_reason = request.data.get("rejection_reason", "")
            doc.verified_by = request.user
            doc.verified_at = timezone.now()
            doc.save(update_fields=["status", "rejection_reason", "verified_by", "verified_at"])

            # Unverify profile if it was verified
            try:
                profile = doc.driver.driver_profile
                if profile.is_verified:
                    profile.is_verified = False
                    profile.save(update_fields=["is_verified"])
            except Exception:
                pass

        return Response(
            {
                "success": True,
                "message": f"Document {'approved' if action == 'approve' else 'rejected'}",
                "data": DriverDocumentSerializer(doc).data,
            }
        )
