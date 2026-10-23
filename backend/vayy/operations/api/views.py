import base64
from uuid import UUID
from decimal import Decimal, InvalidOperation
import logging
from django.http import HttpResponse
from rest_framework import status
from rest_framework.exceptions import (
    PermissionDenied,
    ValidationError,
)
from rest_framework.permissions import (
    BasePermission,
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
    FareConfigurationSerializer,
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
from operations.models import ActiveTrip, DispatchRequest, VehicleState, FareConfiguration
from transport.models import City, CityAdminConfiguration
from operations.permissions import (
    HasBoardingRequestAccess,
    HasTripAccess,
    HasVehicleAccess,
)
from common.constants import (
    TRIP_STATUS_CANCELLED,
    TRIP_STATUS_COMPLETED,
    ROLE_BIKE_DRIVER,
    ROLE_AUTO_DRIVER,
    ROLE_ADMIN,
    ROLE_PASSENGER,
    VEHICLE_BIKE,
    VEHICLE_AUTO,
    DISPATCH_MODE_BROADCAST,
    BOARDING_PENDING,
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
                route_id=(str(serializer.validated_data["route_id"]) if serializer.validated_data.get("route_id") else None),
                target_trip_id=(str(serializer.validated_data["target_trip_id"]) if serializer.validated_data.get("target_trip_id") else None),
                pickup_stop_id=str(serializer.validated_data["pickup_stop_id"]),
                drop_stop_id=str(serializer.validated_data["drop_stop_id"]) if serializer.validated_data.get("drop_stop_id") else None,
                mode=serializer.validated_data.get("mode", DISPATCH_MODE_BROADCAST)
            )
            resp = Response(result, status=status.HTTP_202_ACCEPTED)
            return resp
        except Exception as e:
            logger.exception("[DispatchRequest] Dispatch request failed")
            return Response({"detail": str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

class IsAdminUser(BasePermission):
    """
    Admin access.

    Deliberately not DRF's IsAdminUser, which only tests ``is_staff``: in this
    project admins are identified by ``role == "admin"`` and a staff flag is
    not guaranteed. Defined here, above the admin views that reference it,
    because ``permission_classes`` is evaluated at class-definition time.
    """

    def has_permission(self, request, view):
        return request.user and request.user.is_authenticated and (
            request.user.role == ROLE_ADMIN or request.user.is_staff
        )


class DispatchAssignAPIView(APIView):
    """
    POST /api/operations/dispatch/assign
    Admin assigns a driver/vehicle to a route, creating an ASSIGNED trip.

    Operator override, not part of the passenger dispatch funnel: there is no
    passenger, so the created trip has no boarding request and does not
    participate in settlement.
    """
    # Creates trips and pins them to a specific vehicle, so this is an
    # operator action: any authenticated user could otherwise park the fleet.
    permission_classes = [IsAuthenticated, IsAdminUser]

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
            logger.warning(f"[DispatchAssign] Rejected: {e}")
            return Response({"detail": str(e)}, status=status.HTTP_400_BAD_REQUEST)
        except Exception:
            # Deliberately does not echo str(e): anything reaching here is an
            # unexpected fault, and the detail may carry internals.
            logger.exception("[DispatchAssign] Dispatch assignment failed")
            return Response({"detail": "Internal server error"}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

class DispatchCancelAPIView(APIView):
    """
    POST /api/v1/dispatch/cancel
    Cancels an active dispatch/trip.
    """
    permission_classes = [IsAuthenticated, HasTripAccess]

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
        except PermissionDenied:
            # Ownership is enforced by HasTripAccess and again inside
            # cancel_dispatch; an authorisation failure must not be reported
            # as a 500.
            raise
        except Exception as e:
            logger.exception(f"[DispatchCancel] Cancellation failed for trip {trip_id}")
            return Response({"detail": str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

class DispatchDetailAPIView(APIView):
    """
    GET /api/v1/dispatch/{trip_id}
    Returns details of a dispatch assignment (ActiveTrip).
    """
    permission_classes = [IsAuthenticated, HasTripAccess]

    def get(self, request, trip_id):
        # Already fetched and authorised by HasTripAccess.
        trip = self._owned_object
        resp = Response(ActiveTripSerializer(trip).data)
        return resp


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
        IsAuthenticated,
        HasVehicleAccess,
    ]

    def get(
        self,
        request,
        vehicle_id,
    ):
        vehicle = self._owned_object

        resp = Response(
            VehicleSerializer(vehicle).data
        )
        return resp

class VehicleStateAPIView(APIView):
    permission_classes = [
        IsAuthenticated,
        HasVehicleAccess,
    ]

    def get(
        self,
        request,
        vehicle_id,
    ):
        vehicle = self._owned_object

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
        IsAuthenticated,
        HasTripAccess,
    ]

    def get(
        self,
        request,
        trip_id,
    ):
        trip = self._owned_object

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
            trip = DispatchService.arrived_at_pickup(
                trip_id, request.user, boarding_request_id=request.data.get("boarding_request_id")
            )
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
            trip = DispatchService.start_trip(trip_id, request.user, otp=otp, boarding_request_id=request.data.get("boarding_request_id"))
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
    permission_classes = [IsAuthenticated, HasTripAccess]

    def patch(self, request, trip_id):
        # Ownership (assigned driver, passenger on the trip, or city admin) is
        # enforced by HasTripAccess before this runs; the former inline
        # driver/passenger check moved there so the rule lives in one place.
        try:
            result = DispatchService.complete_trip(trip_id, request.user, boarding_request_id=request.data.get("boarding_request_id"))
            data = result if isinstance(result, dict) else ActiveTripSerializer(result).data
            resp = Response({"success": True, "message": "Trip completed", "data": data})
            return resp
        except Exception as e:
            logger.exception(f"[DispatchComplete] Failed for trip {trip_id}")
            return Response({"success": False, "message": str(e)}, status=status.HTTP_400_BAD_REQUEST)

class TripNextStopsAPIView(APIView):
    permission_classes = [
        IsAuthenticated,
        HasTripAccess,
    ]

    def get(
        self,
        request,
        trip_id,
    ):
        trip = self._owned_object

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
        IsAuthenticated,
        HasBoardingRequestAccess,
    ]

    def get(
        self,
        request,
        request_id,
    ):
        boarding_request = self._owned_object

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
        boarding_request = self._owned_object

        # Stricter than HasBoardingRequestAccess on purpose: the trip driver may
        # *read* a boarding request, but withdrawing it is the passenger's call
        # alone.
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
        except PermissionDenied:
            # Caller was not a passenger on this trip; surface as 403.
            raise
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
            query &= Q(status__in=[TRIP_STATUS_COMPLETED, TRIP_STATUS_CANCELLED])

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
            status=TRIP_STATUS_COMPLETED,
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
        except PermissionDenied:
            # Raised by accept_broadcast_request when this driver was not among
            # the broadcast candidates; must not be reported as a 500.
            raise
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
        except PermissionDenied:
            # Raised by cancel_broadcast_request when the caller is not the
            # passenger who raised it; must not be reported as a 500.
            raise
        except Exception as e:
            logger.exception(f"[BroadcastCancel] Failed for request {request_id}")
            return Response({"detail": str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class TripFareDetailAPIView(APIView):
    """
    GET /api/ride/trip/<trip_id>/fare/
    Returns fare breakdown for a completed/active trip.
    """
    permission_classes = [IsAuthenticated, HasTripAccess]

    def get(self, request, trip_id):
        from operations.services.fare_service import FareService
        from operations.services.ride_service import RideService
        from operations.models import BoardingRequest

        # Authorised by HasTripAccess. Without it this endpoint returned the
        # route-level total_fare to any authenticated user, which leaked a
        # driver's revenue for any trip id.
        trip = self._owned_object

        vehicle_type = trip.vehicle.vehicle_type if trip.vehicle else VEHICLE_BIKE

        # Try to find the passenger's boarding request for per-passenger fare
        boarding_request = BoardingRequest.objects.filter(
            trip=trip, passenger=request.user
        ).first()

        if boarding_request and boarding_request.pickup_stop and boarding_request.drop_stop:
            # Prefer the fare recorded at settlement. Recomputing here meant the
            # screen could show a different number from the one the passenger
            # was actually debited whenever OSRM answered differently or the
            # fare rates changed between the ride and the lookup.
            if boarding_request.fare is not None:
                dist_km = (
                    round(boarding_request.segment_distance_m / 1000, 2)
                    if boarding_request.segment_distance_m
                    else 0.0
                )
                dur_min = (
                    round(boarding_request.segment_duration_s / 60, 1)
                    if boarding_request.segment_duration_s
                    else None
                )
                breakdown = FareService.calculate_fare_breakdown(
                    dist_km, vehicle_type, dur_min
                )
                breakdown["total_fare"] = float(boarding_request.fare)
                # The segment, so a screen can label what was paid for.
                breakdown["segment_distance_m"] = boarding_request.segment_distance_m
                breakdown["segment_duration_s"] = boarding_request.segment_duration_s
                breakdown["pickup_stop_name"] = boarding_request.pickup_stop.name
                breakdown["drop_stop_name"] = (
                    boarding_request.drop_stop.name
                    if boarding_request.drop_stop
                    else None
                )
                breakdown["settled"] = True
                return Response({
                    "success": True,
                    "data": breakdown,
                })

            # Not settled yet (ride still running): fall back to the live
            # estimate of the same segment so the screen has something to show.
            fare = RideService.calculate_segment_fare(
                boarding_request.pickup_stop, boarding_request.drop_stop, vehicle_type
            )
            pickup_lat = boarding_request.pickup_stop.location.y
            pickup_lng = boarding_request.pickup_stop.location.x
            drop_lat = boarding_request.drop_stop.location.y
            drop_lng = boarding_request.drop_stop.location.x
            estimate = RideService.calculate_estimate(pickup_lat, pickup_lng, drop_lat, drop_lng, vehicle_type)
            dist_km = estimate.get("distance_km", 0)
            dur_min = estimate.get("duration_minutes", 0)
            breakdown = FareService.calculate_fare_breakdown(dist_km, vehicle_type, dur_min)
            breakdown["total_fare"] = fare
            breakdown["pickup_stop_name"] = boarding_request.pickup_stop.name
            breakdown["drop_stop_name"] = (
                boarding_request.drop_stop.name
                if boarding_request.drop_stop
                else None
            )
            breakdown["settled"] = False
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
        from common.constants import VEHICLE_STATUS_PENDING

        vehicle_number = request.data.get("vehicle_number", "").strip().upper()
        vehicle_type = request.data.get("vehicle_type", "").strip()
        vehicle_photo = request.data.get("vehicle_photo", "")

        if not vehicle_number:
            return Response(
                {"success": False, "message": "vehicle_number is required"},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if vehicle_type not in (VEHICLE_BIKE, VEHICLE_AUTO):
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
                "vehicle_photo": vehicle_photo,
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
from common.constants import (
    DOC_STATUS_PENDING, DOC_STATUS_VERIFIED, DOC_STATUS_REJECTED,
    VEHICLE_STATUS_PENDING, VEHICLE_STATUS_APPROVED, VEHICLE_STATUS_REJECTED,
)


class AdminPendingDriversAPIView(APIView):
    """
    GET /api/operations/admin/drivers/pending/
    Returns drivers with pending vehicle approval OR pending documents.
    """
    permission_classes = [IsAuthenticated, IsAdminUser]

    def get(self, request):
        from operations.models import Vehicle
        from django.db.models import F, Q

        # Drivers with vehicle pending approval
        pending_vehicles = Vehicle.objects.filter(
            status=VEHICLE_STATUS_PENDING,
            vehicle_number__gt="",
            driver__driver_profile__vehicle_number__gt="",
            vehicle_number=F("driver__driver_profile__vehicle_number"),
        ).select_related("driver", "driver__driver_profile")

        pending_driver_ids = set()
        result = []

        for vehicle in pending_vehicles:
            driver = vehicle.driver
            if not driver or driver.id in pending_driver_ids:
                continue
            pending_driver_ids.add(driver.id)

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
                    "bio": getattr(profile, "bio", "") or "",
                    "rc_number": getattr(profile, "rc_number", "") or "",
                    "dob": profile.dob.isoformat() if getattr(profile, "dob", None) else None,
                    "gender": getattr(profile, "gender", "") or "",
                } if profile else None,
                "vehicle": {
                    "id": str(vehicle.id),
                    "vehicle_number": vehicle.vehicle_number,
                    "vehicle_type": vehicle.vehicle_type,
                    "status": vehicle.status,
                    "is_active": vehicle.is_active,
                    "vehicle_photo": vehicle.vehicle_photo or "",
                } if vehicle else None,
                "documents": DriverDocumentSerializer(docs, many=True).data,
            })

        # Also include drivers with PENDING documents who have no pending vehicle
        drivers_with_pending_docs = User.objects.filter(
            role__in=[ROLE_BIKE_DRIVER, ROLE_AUTO_DRIVER],
            documents__status=DOC_STATUS_PENDING,
            driver_profile__vehicle_number__gt="",
            assigned_vehicle__isnull=False,
            assigned_vehicle__vehicle_number=F("driver_profile__vehicle_number"),
        ).exclude(
            id__in=pending_driver_ids
        ).select_related("driver_profile").distinct()

        for driver in drivers_with_pending_docs:
            profile = getattr(driver, "driver_profile", None)
            docs = DriverDocument.objects.filter(driver=driver)
            vehicle = Vehicle.objects.filter(driver=driver).first()

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
                    "bio": getattr(profile, "bio", "") or "",
                    "rc_number": getattr(profile, "rc_number", "") or "",
                    "dob": profile.dob.isoformat() if getattr(profile, "dob", None) else None,
                    "gender": getattr(profile, "gender", "") or "",
                } if profile else None,
                "vehicle": {
                    "id": str(vehicle.id),
                    "vehicle_number": vehicle.vehicle_number,
                    "vehicle_type": vehicle.vehicle_type,
                    "status": vehicle.status,
                    "is_active": vehicle.is_active,
                    "vehicle_photo": vehicle.vehicle_photo or "",
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
            profile = PublicDriverProfile.objects.filter(user=driver).first()
            vehicle = Vehicle.objects.filter(driver=driver).first()
            if (
                not profile
                or not profile.vehicle_number.strip()
                or not vehicle
                or vehicle.vehicle_number.strip().upper() != profile.vehicle_number.strip().upper()
            ):
                return Response({
                    "success": False,
                    "code": "VEHICLE_KYC_REQUIRED",
                    "message": "Add the driver's vehicle number and register the matching vehicle before approval.",
                }, status=status.HTTP_400_BAD_REQUEST)

            from accounts.services.verification_service import VerificationService
            missing_slots = VerificationService.missing_required_slots(driver)
            if missing_slots:
                return Response({
                    "success": False,
                    "code": "DRIVER_DOCUMENTS_INCOMPLETE",
                    "message": "Upload all required driver and vehicle documents before approval.",
                    "missing_slots": missing_slots,
                }, status=status.HTTP_400_BAD_REQUEST)

            Vehicle.objects.filter(driver=driver).update(
                status=VEHICLE_STATUS_APPROVED,
                is_active=True,
            )

            # Mark all documents as verified
            DriverDocument.objects.filter(driver=driver, status=DOC_STATUS_PENDING).update(
                status=DOC_STATUS_VERIFIED,
                verified_by=request.user,
                verified_at=timezone.now(),
                rejection_reason="",
            )
            VerificationService.check_and_verify_profile(driver)

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
            Vehicle.objects.filter(driver=driver).update(status=VEHICLE_STATUS_REJECTED)
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
            doc.status = DOC_STATUS_VERIFIED
            doc.verified_by = request.user
            doc.verified_at = timezone.now()
            doc.rejection_reason = ""
            doc.save(update_fields=["status", "rejection_reason", "verified_by", "verified_at"])

            # Auto-verify profile if all required docs are now verified
            from accounts.services.verification_service import VerificationService
            VerificationService.check_and_verify_profile(doc.driver)
        else:
            doc.status = DOC_STATUS_REJECTED
            doc.rejection_reason = request.data.get("rejection_reason", "")
            doc.verified_by = request.user
            doc.verified_at = timezone.now()
            doc.save(update_fields=["status", "rejection_reason", "verified_by", "verified_at"])

            # Keep the profile flag synchronized with required document state.
            from accounts.services.verification_service import VerificationService
            VerificationService.check_and_verify_profile(doc.driver)

        return Response(
            {
                "success": True,
                "message": f"Document {'approved' if action == 'approve' else 'rejected'}",
                "data": DriverDocumentSerializer(doc).data,
            }
        )


class AdminDocumentFileAPIView(APIView):
    """
    GET /api/operations/admin/documents/<uuid:doc_id>/file/
    Returns the raw document file for admin review (open/print).
    """
    permission_classes = [IsAuthenticated, IsAdminUser]

    def get(self, request, doc_id):
        try:
            doc = DriverDocument.objects.get(id=doc_id)
        except DriverDocument.DoesNotExist:
            return Response(
                {"success": False, "message": "Document not found"},
                status=status.HTTP_404_NOT_FOUND,
            )

        if not doc.file_data:
            return Response(
                {"success": False, "message": "Document has no file data"},
                status=status.HTTP_404_NOT_FOUND,
            )

        try:
            payload = base64.b64decode(doc.file_data)
        except Exception:
            return Response(
                {"success": False, "message": "Document file data is corrupt"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        import mimetypes
        content_type = mimetypes.guess_type(doc.file_name or "")[0] or "application/octet-stream"
        filename = doc.file_name or "document"

        response = HttpResponse(payload, content_type=content_type)
        response["Content-Disposition"] = 'inline; filename="' + filename + '"'
        response["Cache-Control"] = "no-cache"
        return response


def _resolve_admin_city(value):
    value = str(value or "").strip()
    if not value:
        return None
    city = City.objects.filter(slug__iexact=value).first() or City.objects.filter(name__iexact=value).first()
    if city is not None:
        return city
    try:
        city_id = UUID(value)
    except (TypeError, ValueError):
        return None
    return City.objects.filter(pk=city_id).first()


class FareConfigurationListCreateAPIView(APIView):
    """Support both the legacy per-vehicle fare screen and Dynamic Routing's per-city pricing contract."""
    permission_classes = [IsAuthenticated]

    @staticmethod
    def _is_admin(user):
        return user.is_authenticated and (getattr(user, "role", None) == "admin" or user.is_staff)

    @staticmethod
    def _city_row(city):
        try:
            config = city.admin_configuration
        except CityAdminConfiguration.DoesNotExist:
            config = None
        return {
            "city": city.slug,
            "city_name": city.name,
            "city_id": str(city.id),
            "fare_per_km": float(config.fare_per_km) if config else 8.0,
            "platform_fee": float(config.platform_fee) if config else 0.0,
            "rounding_rule": config.rounding_rule if config else "none",
            "currency": config.currency if config else "INR",
            "corridor_m": config.corridor_m if config else 100,
            "max_walk_to_stop_m": config.max_walk_to_stop_m if config else 3000,
            "is_active": config.is_active if config else True,
        }

    def get(self, request):
        if not self._is_admin(request.user):
            return Response({"success": False, "message": "Admin access required"}, status=status.HTTP_403_FORBIDDEN)
        global_configs = FareConfiguration.objects.all().order_by("-effective_from")
        legacy_data = FareConfigurationSerializer(global_configs, many=True).data
        city_rows = [self._city_row(city) for city in City.objects.select_related("admin_configuration").order_by("name")]
        # Legacy FareConfigurations.jsx reads data; DynamicRouting.rowsOf reads results.
        return Response({"success": True, "data": legacy_data, "results": city_rows,
                         "count": len(city_rows)}, status=status.HTTP_200_OK)

    def post(self, request):
        if not self._is_admin(request.user):
            return Response({"success": False, "message": "Admin access required"}, status=status.HTTP_403_FORBIDDEN)

        # Dynamic Routing sends a city slug and rupee-denominated fields.
        if "city" in request.data:
            city_value = str(request.data.get("city") or "").strip()
            city = _resolve_admin_city(city_value)
            if city is None:
                return Response({"success": False, "message": "City not found. Refresh the city list and try again."}, status=404)

            allowed = {"fare_per_km", "platform_fee", "rounding_rule", "currency", "corridor_m", "max_walk_to_stop_m", "is_active"}
            supplied = {key: request.data[key] for key in allowed if key in request.data}
            defaults = {}
            try:
                for key in ("fare_per_km", "platform_fee"):
                    if key in supplied:
                        value = Decimal(str(supplied[key]))
                        if not value.is_finite() or value < 0:
                            raise ValueError(f"{key} must be a non-negative number.")
                        defaults[key] = value
                for key in ("corridor_m", "max_walk_to_stop_m"):
                    if key in supplied:
                        value = int(supplied[key])
                        if value < 0:
                            raise ValueError(f"{key} must be non-negative.")
                        defaults[key] = value
                if "rounding_rule" in supplied:
                    valid_rules = {"none", "nearest_unit", "ceil_unit", "floor_unit"}
                    if supplied["rounding_rule"] not in valid_rules:
                        raise ValueError("rounding_rule is invalid.")
                    defaults["rounding_rule"] = supplied["rounding_rule"]
                if "currency" in supplied:
                    currency = str(supplied["currency"]).strip().upper()
                    if len(currency) != 3:
                        raise ValueError("currency must be a 3-letter currency code.")
                    defaults["currency"] = currency
                if "is_active" in supplied:
                    raw_active = supplied["is_active"]
                    if isinstance(raw_active, str):
                        raw_active = raw_active.lower() in ("true", "1", "yes")
                    defaults["is_active"] = bool(raw_active)
            except (InvalidOperation, TypeError, ValueError) as exc:
                return Response({"success": False, "message": str(exc) or "Invalid city fare configuration."}, status=400)

            config, _ = CityAdminConfiguration.objects.get_or_create(city=city)
            for key, value in defaults.items():
                setattr(config, key, value)
            if defaults:
                config.save()
            return Response({"success": True, "data": self._city_row(city)}, status=status.HTTP_200_OK)

        # Preserve the older vehicle-type form. Its values are already in paise.
        serializer = FareConfigurationSerializer(data=request.data)
        serializer.validators = []  # the model's historical unique_together blocked creating a new active version
        if not serializer.is_valid():
            return Response({"success": False, "message": serializer.errors}, status=status.HTTP_400_BAD_REQUEST)
        if serializer.validated_data["base_fare"] < 0 or serializer.validated_data["per_km_rate"] < 0:
            return Response({"success": False, "message": "Fare values must be non-negative."}, status=400)
        from django.db import transaction
        with transaction.atomic():
            FareConfiguration.objects.filter(
                vehicle_type=serializer.validated_data["vehicle_type"], is_active=True
            ).update(is_active=False)
            config = serializer.save(is_active=True)
        return Response({"success": True, "data": FareConfigurationSerializer(config).data}, status=status.HTTP_201_CREATED)


class FareConfigurationQuoteAPIView(APIView):
    """Preview fare using the same city-specific pricing rules as Dynamic Routing."""
    permission_classes = [IsAuthenticated]

    def post(self, request):
        from decimal import Decimal, InvalidOperation, ROUND_CEILING, ROUND_FLOOR, ROUND_HALF_UP
        user = request.user
        if not (user.is_authenticated and (getattr(user, "role", None) == "admin" or user.is_staff)):
            return Response({"success": False, "message": "Admin access required"}, status=403)
        city_value = str(request.data.get("city") or "").strip()
        if not city_value:
            return Response({"success": False, "message": "city is required."}, status=400)
        city = _resolve_admin_city(city_value)
        if city is None:
            return Response({"success": False, "message": "City not found."}, status=404)
        try:
            distance_m = Decimal(str(request.data.get("route_distance_m")))
        except (InvalidOperation, TypeError):
            return Response({"success": False, "message": "route_distance_m must be a number."}, status=400)
        if not distance_m.is_finite() or distance_m < 0 or distance_m > Decimal("2000000"):
            return Response({"success": False, "message": "route_distance_m must be between 0 and 2,000,000 metres."}, status=400)

        city_config = CityAdminConfiguration.objects.filter(city=city).first()
        if city_config and not city_config.is_active:
            return Response({"success": False, "message": "This city is inactive for routing."}, status=400)
        distance_km = distance_m / Decimal("1000")
        if city_config:
            base = Decimal("0")
            rate = Decimal(city_config.fare_per_km)
            platform_fee = Decimal(city_config.platform_fee)
            rounding_rule = city_config.rounding_rule
            currency = city_config.currency
        else:
            # Match the Dynamic Routing city editor's default until a city-specific
            # configuration is explicitly saved. Global vehicle fares serve legacy flows.
            base = Decimal("0")
            rate = Decimal("8.00")
            platform_fee = Decimal("0")
            rounding_rule = "none"
            currency = "INR"
        base_fare = base.quantize(Decimal("0.01"))
        distance_fare = (distance_km * rate).quantize(Decimal("0.01"))
        subtotal = base_fare + distance_fare
        if rounding_rule == "nearest_unit":
            subtotal = subtotal.quantize(Decimal("1"), rounding=ROUND_HALF_UP)
        elif rounding_rule == "ceil_unit":
            subtotal = subtotal.quantize(Decimal("1"), rounding=ROUND_CEILING)
        elif rounding_rule == "floor_unit":
            subtotal = subtotal.quantize(Decimal("1"), rounding=ROUND_FLOOR)
        total = (subtotal + platform_fee).quantize(Decimal("0.01"))
        data = {
            "city": city.slug, "city_name": city.name, "distance_km": round(float(distance_km), 2),
            "rate_per_km": float(rate), "base_fare": float(base_fare),
            "platform_fee": float(platform_fee), "distance_fare": float(distance_fare),
            "buddy_fare": float(total), "marshal_earning": float(subtotal),
            "total_fare": float(total), "currency": currency, "rounding_rule": rounding_rule,
            "formula": "base fare + distance × city rate + platform fee, with configured rounding",
        }
        return Response({"success": True, "data": data}, status=200)
