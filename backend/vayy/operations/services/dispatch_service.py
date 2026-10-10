import logging
import random
from decimal import Decimal
from typing import Dict, Any, List, Optional
from geopy.distance import distance as geopy_distance
from django.db import transaction
from django.utils import timezone
from django.contrib.gis.geos import Point
from django.contrib.gis.measure import D
from django.contrib.gis.db.models.functions import Distance
from asgiref.sync import async_to_sync
from channels.layers import get_channel_layer
from rest_framework.exceptions import PermissionDenied

from datetime import timedelta
from accounts.models import User, PublicDriverProfile
from operations.models import Vehicle, ActiveTrip, VehicleState, BoardingRequest, DispatchRequest
from transport.models import Route, TripSchedule, Stop
from communication.services.rabbitmq_service import RabbitMQService
from communication.services.notification_service import NotificationService
from accounts.services.wallet_service import WalletService
from operations.services.ride_service import RideService
from operations.services.fare_service import FareService
from tracking.services.redis_geo_service import RedisGeoService
from tracking.services.corridor_service import CorridorService
from common.constants import (
    EXCHANGE_DISPATCH, RK_DISPATCH_ASSIGN, RK_DISPATCH_CANCEL, RK_DISPATCH_EVENT,
    BOARDING_PENDING, BOARDING_BOARDED, BOARDING_COMPLETED, BOARDING_CANCELLED,
    TRIP_STATUS_REQUESTED, TRIP_STATUS_ASSIGNED, TRIP_STATUS_ACCEPTED,
    TRIP_STATUS_REJECTED, TRIP_STATUS_ARRIVED, TRIP_STATUS_ACTIVE,
    TRIP_STATUS_COMPLETED, TRIP_STATUS_CANCELLED, TRIP_STATUS_PARTIALLY_SETTLED,
    ROLE_BIKE_DRIVER, ROLE_AUTO_DRIVER,
    VEHICLE_BIKE,
    DISPATCH_MODE_BROADCAST,
)

logger = logging.getLogger(__name__)

# Mirrors accounts.permissions.IsDriver, which is a permission class and so
# cannot be reused from the service layer.
DRIVER_ROLES = (ROLE_BIKE_DRIVER, ROLE_AUTO_DRIVER)


def _passenger_display_name(dispatch_request) -> str:
    """
    The name a driver should see for the rider they just accepted.

    Prefers the passenger profile's display name, since that is what the
    passenger chose to be called; falls back to the account name and email so a
    rider without a profile is still identifiable rather than blank.
    """
    return _user_display_name(dispatch_request.passenger)


def _user_display_name(user) -> str:
    """
    A person's display name, preferring their profile over their account row.

    Shared because ``get_full_name()`` reads first/last name, which this User
    model does not define - it is empty for every account, so using it directly
    showed drivers an email or a blank string instead of a name.
    """
    if user is None:
        return ""
    for attr in ("passenger_profile", "driver_profile"):
        profile = getattr(user, attr, None)
        if profile and profile.display_name:
            return profile.display_name
    return user.get_full_name() or user.email


def _passenger_phone(dispatch_request) -> str:
    """
    The passenger's contact number for the driver's call action.

    Read from the profile: the account row carries no phone, and exposing a
    number a rider did not register for contact would be the wrong one to dial.
    """
    return _user_phone(dispatch_request.passenger)


def _user_phone(user) -> str:
    if user is None:
        return ""
    profile = getattr(user, "passenger_profile", None)
    return (profile.phone_number if profile else "") or ""


class DispatchService:
    """
    Handles driver-vehicle matching, trip assignments, and dispatching.
    """

    @staticmethod
    def _notify_ws(group_name: str, event_type: str, data: Dict[str, Any]):
        channel_layer = get_channel_layer()
        async_to_sync(channel_layer.group_send)(
            group_name,
            {
                "type": event_type,
                "data": data
            }
        )

    @staticmethod
    def request_dispatch(passenger: User, route_id: str, pickup_stop_id: str, drop_stop_id: str = None, mode: str = DISPATCH_MODE_BROADCAST) -> Dict[str, Any]:
        """
        Initiates a ride request and triggers the matching engine.
        Supports 'direct' and 'broadcast' modes.

        ``route_id`` is optional: a journey-scoped request (route NULL) is
        raised at a global stop and offered to whichever drivers' journeys pass
        that stop.
        """
        logger.info(f"Dispatch requested by passenger {passenger.id} for route {route_id} (mode: {mode})")

        if route_id:
            # Find candidates
            candidates = DispatchService.find_best_candidates(route_id, pickup_stop_id)
        else:
            candidates = DispatchService.find_candidates_for_stop(pickup_stop_id)

        if not candidates:
            return {"status": "no_drivers_available", "message": "No drivers found nearby"}

        # A journey request is always broadcast. Its candidates are drivers
        # already mid-journey, so a direct assign would conflict with the live
        # trip they are running; attaching them is what the accept path does.
        if route_id is None or mode == DISPATCH_MODE_BROADCAST:
            return DispatchService._handle_broadcast_dispatch(passenger, route_id, pickup_stop_id, drop_stop_id, candidates)

        best_candidate = candidates[0]
        return DispatchService._assign_to_driver(passenger, route_id, pickup_stop_id, best_candidate, drop_stop_id)

    @staticmethod
    def _assign_to_driver(passenger: User, route_id: Optional[str], pickup_stop_id: str, candidate: Dict[str, Any], drop_stop_id: str = None) -> Dict[str, Any]:
        """
        Direct (non-broadcast) assignment of a passenger to one driver.

        Route-scoped only. A journey-scoped request is always broadcast,
        because its candidates are mid-journey and this path would reject them
        all as "on another trip".
        """
        # Guard: ensure driver is still available
        vehicle_state = VehicleState.objects.filter(vehicle=candidate['vehicle']).first()
        if not vehicle_state:
            return {"status": "no_vehicle", "message": "Vehicle state not found"}
        if vehicle_state.occupancy_count > 0:
            return {"status": "driver_busy", "message": "Driver already has an active passenger"}
        if vehicle_state.active_trip is not None:
            return {"status": "driver_busy", "message": "Driver is on another trip"}

        # Create Trip in 'assigned' state
        route = Route.objects.get(id=route_id)
        trip = ActiveTrip.objects.create(
            vehicle=candidate['vehicle'],
            route=route,
            driver=candidate['driver'],
            status=TRIP_STATUS_ASSIGNED,
            started_at=timezone.now()
        )

        # Get drop stop if provided
        drop_stop = None
        if drop_stop_id:
            try:
                drop_stop = Stop.objects.get(id=drop_stop_id, route_id=route_id)
            except Stop.DoesNotExist:
                pass

        # Link the passenger to the trip + pickup stop so live tracking can
        # report the true distance to pickup (not remaining route distance).
        try:
            stop = Stop.objects.get(id=pickup_stop_id)
            BoardingRequest.objects.create(
                passenger=passenger,
                trip=trip,
                pickup_stop=stop,
                drop_stop=drop_stop,
                status=BOARDING_PENDING,
            )
        except Stop.DoesNotExist:
            logger.error(
                f"[Dispatch] Pickup stop {pickup_stop_id} not found for trip {trip.id} — "
                f"passenger {passenger.id} has no boarding link"
            )
            raise ValueError(f"Pickup stop {pickup_stop_id} not found")
        except Exception as e:
            logger.error(
                f"[Dispatch] Failed to create boarding request for trip {trip.id}: {e} — "
                f"trip was created but passenger is unlinked"
            )

        payload = {
            "trip_id": str(trip.id),
            "passenger_id": str(passenger.id),
            "driver_id": str(trip.driver.id),
            "route_id": route_id,
            "pickup_stop_id": pickup_stop_id,
            "drop_stop_id": str(drop_stop.id) if drop_stop else None,
            "status": trip.status,
            "requested_at": timezone.now().isoformat()
        }
        
        # 3. Publish to RabbitMQ for workers
        RabbitMQService.publish(
            exchange=EXCHANGE_DISPATCH,
            routing_key=RK_DISPATCH_ASSIGN,
            payload=payload
        )

        # 4. Notify via WebSockets
        DispatchService._notify_ws(f"dispatch_{trip.id}", "dispatch_update", payload)
        DispatchService._notify_ws(f"notifications_{trip.driver.id}", "notification_broadcast", {
            "title": "New Assignment",
            "message": f"You have a new ride request for {route.name}",
            "trip_id": str(trip.id)
        })

        # Schedule timeout check (10s per candidate, cascades to next on expiry)
        from operations.tasks import check_assignment_timeout
        check_assignment_timeout.apply_async((str(trip.id),), countdown=10)
        
        return {"status": "assigned", "trip_id": str(trip.id), "driver_name": _user_display_name(trip.driver)}

    def assign_trip(
        vehicle_id: str,
        driver_id: str,
        route_id: str,
        trip_schedule_id: Optional[str] = None,
    ) -> ActiveTrip:
        """
        Admin-initiated assignment: put a specific vehicle/driver on a route.

        This is the operator override path, deliberately separate from
        ``_assign_to_driver`` which is passenger-driven: there is no passenger
        and therefore no ``BoardingRequest`` to create, and no candidate
        ranking to do because the operator has already chosen the vehicle.

        Locking: the vehicle row and its ``VehicleState`` are taken with
        ``select_for_update`` for the whole check-and-create, so two admins
        assigning the same vehicle at once cannot both pass the availability
        check and leave two ASSIGNED trips pointing at one vehicle. The
        passenger path in ``_assign_to_driver`` still does this unlocked - a
        pre-existing gap this method does not inherit.
        """
        with transaction.atomic():
            try:
                vehicle = Vehicle.objects.select_for_update().select_related("driver").get(id=vehicle_id)
            except Vehicle.DoesNotExist:
                raise ValueError(f"Vehicle {vehicle_id} not found")

            if not vehicle.is_active:
                raise ValueError(f"Vehicle {vehicle_id} is not active")

            # The operator names a driver and a vehicle; if they disagree the
            # trip would be attributed to a driver who does not own the
            # vehicle, and every later driver-scoped check would misfire.
            if vehicle.driver_id is None:
                raise ValueError(f"Vehicle {vehicle_id} has no driver assigned")
            if str(vehicle.driver_id) != str(driver_id):
                raise ValueError(
                    f"Driver {driver_id} is not assigned to vehicle {vehicle_id} "
                    f"(vehicle belongs to {vehicle.driver_id})"
                )

            driver = vehicle.driver
            if driver.role not in DRIVER_ROLES:
                raise ValueError(f"User {driver_id} is not a driver")

            try:
                route = Route.objects.get(id=route_id)
            except Route.DoesNotExist:
                raise ValueError(f"Route {route_id} not found")

            trip_schedule = None
            if trip_schedule_id:
                try:
                    trip_schedule = TripSchedule.objects.get(id=trip_schedule_id)
                except TripSchedule.DoesNotExist:
                    raise ValueError(f"Trip schedule {trip_schedule_id} not found")
                # A schedule belongs to a route; pairing it with another route
                # would produce next-stops from the wrong line.
                if str(trip_schedule.route_id) != str(route_id):
                    raise ValueError(
                        f"Trip schedule {trip_schedule_id} does not belong to route {route_id}"
                    )

            state, _ = VehicleState.objects.select_for_update().get_or_create(vehicle=vehicle)
            if state.active_trip is not None:
                raise ValueError(
                    f"Vehicle {vehicle_id} is already on trip {state.active_trip_id}"
                )
            if state.occupancy_count > 0:
                raise ValueError(
                    f"Vehicle {vehicle_id} already has {state.occupancy_count} passenger(s) aboard"
                )

            trip = ActiveTrip.objects.create(
                vehicle=vehicle,
                route=route,
                trip_schedule=trip_schedule,
                driver=driver,
                status=TRIP_STATUS_ASSIGNED,
                started_at=timezone.now(),
            )
            state.active_trip = trip
            state.save(update_fields=["active_trip"])

        # Outside the transaction: no row lock should be held across a publish.
        payload = {
            "trip_id": str(trip.id),
            "driver_id": str(driver.id),
            "route_id": str(route.id),
            "vehicle_id": str(vehicle.id),
            "status": trip.status,
            "assigned_by": "admin",
            "requested_at": timezone.now().isoformat(),
        }

        # The trip is already committed at this point, so a broker/channel
        # failure must not surface as a failed request: the operator would
        # retry and be rejected with "already on trip", while a trip they
        # believe was never created is actually running. Report success, log
        # loudly; the assignment is durable and the driver still sees it on
        # their next location poll.
        try:
            RabbitMQService.publish(
                exchange=EXCHANGE_DISPATCH,
                routing_key=RK_DISPATCH_ASSIGN,
                payload=payload,
            )
            DispatchService._notify_ws(
                f"dispatch_{trip.id}", "dispatch_update", payload
            )
            DispatchService._notify_ws(
                f"notifications_{driver.id}", "notification_broadcast",
                {
                    "title": "New Assignment",
                    "message": f"You have been assigned to {route.name}",
                    "trip_id": str(trip.id),
                },
            )
        except Exception:
            logger.exception(
                "Trip %s assigned and committed, but dispatch notification failed",
                trip.id,
            )

        # NOTE: check_assignment_timeout is deliberately NOT scheduled here.
        # That cascade re-dispatches to the next candidate driver for a
        # boarding request; an admin trip has no passenger, so the cascade
        # would find no BoardingRequest and cancel the trip after 10s.

        logger.info(
            "Admin assigned trip %s: vehicle=%s driver=%s route=%s",
            trip.id, vehicle.id, driver.id, route.id,
        )
        return trip

    @staticmethod
    def _handle_broadcast_dispatch(passenger: User, route_id: Optional[str], pickup_stop_id: str, drop_stop_id: str, candidates: List[Dict], dispatch_request: Optional[DispatchRequest] = None) -> Dict[str, Any]:
        """
        Broadcasts the dispatch request to ALL nearby drivers on the route.
        First driver to accept wins; others get dismissed via WS.

        When dispatch_request is provided (re-dispatch after expiry), the SAME
        request_id is reused so the passenger's broadcast WS group
        (broadcast_{request_id}) stays valid across all retry rounds.

        ``route_id`` may be None for a journey-scoped request. The drop stop is
        then taken only from the request, never inferred from the route end,
        because there is no route end to infer it from.
        """
        from transport.models import Stop

        stop = Stop.objects.get(id=pickup_stop_id)
        route = Route.objects.get(id=route_id) if route_id else None
        passenger_name = _user_display_name(passenger)

        # Get drop stop if provided
        drop_stop = None
        if drop_stop_id:
            try:
                drop_stop = Stop.objects.get(
                    id=drop_stop_id, **({"route_id": route_id} if route_id else {})
                )
            except Stop.DoesNotExist:
                pass

        # Reuse the same broadcast request id for re-dispatch rounds so the
        # passenger keeps listening on broadcast_{request_id}. Merge the new
        # candidate drivers into notified_drivers and extend the deadline.
        existing = dispatch_request
        if existing is not None:
            notified = set(existing.notified_drivers)
            notified.update(str(c["driver"].id) for c in candidates)
            existing.status = DispatchRequest.STATUS_PENDING
            existing.notified_drivers = list(notified)
            existing.expires_at = timezone.now() + timedelta(seconds=45)
            existing.save(update_fields=["status", "notified_drivers", "expires_at"])
            dispatch_request = existing
        else:
            # Create broadcast dispatch request
            dispatch_request = DispatchRequest.objects.create(
                passenger=passenger,
                route=route,
                pickup_stop=stop,
                pickup_lat=stop.location.y,
                pickup_lng=stop.location.x,
                drop_stop=drop_stop,
                drop_lat=drop_stop.location.y if drop_stop else None,
                drop_lng=drop_stop.location.x if drop_stop else None,
                notified_drivers=[str(c["driver"].id) for c in candidates],
                expires_at=timezone.now() + timedelta(seconds=45),
            )

        # Shared request metadata for all candidate drivers
        if drop_stop:
            drop_name = drop_stop.name
            drop_lat = drop_stop.location.y
            drop_lng = drop_stop.location.x
        elif route:
            drop_name = route.end_name or route.name
            drop_lat = drop_lng = None
            try:
                if route.path:
                    drop_lng, drop_lat = route.path.coords[-1]
            except Exception:
                pass
        else:
            # Journey request with no drop stop: the destination is wherever the
            # passenger says it is, so leave it unstated rather than inventing
            # the end of a route that does not exist.
            drop_name = ""
            drop_lat = drop_lng = None

        passenger_rating = None
        passenger_trips = 0
        try:
            pp = passenger.passenger_profile
            passenger_rating = round(pp.rating, 1)
            passenger_trips = pp.total_trips
        except Exception:
            pass

        # Notify EACH candidate driver via their notification WS
        for candidate in candidates:
            driver = candidate["driver"]
            vehicle_type = candidate["vehicle"].vehicle_type

            # Fare estimate from pickup stop to route end (vehicle-type specific)
            fare = None
            # A journey hand-raise names the destination as a stop rather than
            # sending coordinates, so fall back to it; otherwise the driver saw
            # no fare at all on every journey request.
            if (drop_lat is None or drop_lng is None) and drop_stop is not None:
                try:
                    drop_lat = drop_stop.location.y
                    drop_lng = drop_stop.location.x
                except Exception:
                    pass
            if drop_lat is not None and drop_lng is not None:
                try:
                    estimate = RideService.calculate_estimate(
                        stop.location.y, stop.location.x,
                        drop_lat, drop_lng,
                        vehicle_type,
                    )
                    fare = round(estimate["estimated_fare"], 2)
                except Exception as e:
                    logger.warning(f"Failed to estimate fare for dispatch {dispatch_request.id}: {e}")

            # ETA to pickup (~30 km/h average city speed)
            eta = max(1, round(candidate["distance"] / 30 * 60))

            payload = {
                "type": "new_dispatch_request",
                "dispatch": {
                    "request_id": str(dispatch_request.id),
                    "passenger_id": str(passenger.id),
                    "passenger_name": passenger_name,
                    "passenger_rating": passenger_rating,
                    "passenger_trips": passenger_trips,
                    "route_id": route_id,
                    # route_name is null on a journey request; the driver reads
                    # pickup/drop below, and the driver app labels a journey by
                    # its own endpoints.
                    "route_name": route.name if route else None,
                    "pickup_stop_id": pickup_stop_id,
                    "pickup_name": stop.name,
                    "pickup_lat": stop.location.y,
                    "pickup_lng": stop.location.x,
                    "drop_name": drop_name,
                    "drop_lat": drop_lat,
                    "drop_lng": drop_lng,
                    "distance_km": round(candidate["distance"], 2),
                    "eta": eta,
                    "fare": fare,
                    "score": round(candidate["score"], 1),
                },
            }
            DispatchService._notify_ws(
                f"notifications_{driver.id}",
                "notification_broadcast",
                payload,
            )

        # Schedule the next expiry round — expire if no one accepts. The
        # cascade in operations.tasks is bounded by DispatchRequest.max_rounds,
        # so this cannot reschedule forever.
        from operations.tasks import expire_broadcast_request, BROADCAST_ROUND_SECONDS
        expire_broadcast_request.apply_async(
            (str(dispatch_request.id),),
            countdown=BROADCAST_ROUND_SECONDS,
        )

        logger.info(
            f"Broadcast dispatch {dispatch_request.id} sent to {len(candidates)} drivers "
            f"on route {route.name if route else f'stop {pickup_stop_id}'}"
        )

        return {
            "status": BOARDING_PENDING,
            "request_id": str(dispatch_request.id),
            "drivers_notified": len(candidates),
        }

    @staticmethod
    @transaction.atomic
    def accept_broadcast_request(request_id: str, driver: User) -> Dict[str, Any]:
        """
        Driver accepts a broadcast dispatch request.
        Uses atomic UPDATE with WHERE status='pending' to guarantee exactly one winner.

        The driver must be one of the candidates the request was actually
        broadcast to. Without this, any driver who learned a request id could
        claim a ride they were never offered, winning the atomic claim and
        stranding the drivers who were.

        Two accept shapes:

        * journey-scoped request (``route`` is NULL) - the driver already has an
          ACTIVE journey passing the pickup stop. The passenger is attached to
          that journey as a BoardingRequest; no second trip is created, because
          the journey is the trip and it carries many riders.
        * route-scoped request (legacy) - one trip per passenger, as before.
        """
        # Checked before the claim so an ineligible driver cannot consume the
        # request. notified_drivers is written when the request is created and
        # merged on every re-dispatch round, so it is the authoritative list.
        offered_to = DispatchRequest.objects.filter(
            id=request_id
        ).values_list("notified_drivers", flat=True).first()

        if offered_to is None:
            raise DispatchRequest.DoesNotExist

        if str(driver.id) not in {str(d) for d in offered_to}:
            raise PermissionDenied(
                "This dispatch request was not offered to you"
            )

        # Atomic claim — only one driver wins. The UPDATE with WHERE status='pending'
        # is a single SQL statement; two concurrent transactions cannot both succeed.
        updated = DispatchRequest.objects.filter(
            id=request_id,
            status=DispatchRequest.STATUS_PENDING,
        ).update(
            status=DispatchRequest.STATUS_ACCEPTED,
            accepted_by=driver,
        )
        if updated == 0:
            return {
                "status": "already_taken",
                "message": "Ride no longer available",
            }

        # Re-read the claimed request (now STATUS_ACCEPTED) for downstream use
        dispatch_request = DispatchRequest.objects.get(id=request_id)

        if dispatch_request.route_id is None:
            return DispatchService._accept_journey_request(dispatch_request, driver)

        # Find driver's vehicle
        vehicle_state = VehicleState.objects.select_related("vehicle").filter(
            vehicle__driver=driver,
            vehicle__is_active=True,
        ).first()

        if not vehicle_state:
            # Roll back — release the claim so another driver can try
            dispatch_request.status = DispatchRequest.STATUS_PENDING
            dispatch_request.accepted_by = None
            dispatch_request.save()
            return {
                "status": "no_vehicle",
                "message": "No active vehicle found for this driver",
            }

        # Create ActiveTrip with OTP — status ACCEPTED since driver already accepted
        otp = f"{random.randint(1000, 9999)}"
        trip = ActiveTrip.objects.create(
            vehicle=vehicle_state.vehicle,
            route=dispatch_request.route,
            driver=driver,
            status=TRIP_STATUS_ACCEPTED,
            started_at=timezone.now(),
            otp=otp,
        )

        # Link the passenger to the trip + pickup stop so live tracking can
        # report the true distance to pickup (not remaining route distance).
        try:
            # Savepoint for the same reason as the journey branch: a caught
            # IntegrityError inside this @transaction.atomic still aborts the
            # transaction, and the notifications below would then all fail.
            with transaction.atomic():
                BoardingRequest.objects.create(
                    passenger=dispatch_request.passenger,
                    trip=trip,
                    pickup_stop=dispatch_request.pickup_stop,
                    drop_stop=dispatch_request.drop_stop,
                    status=BOARDING_PENDING,
                )
        except Exception as e:
            logger.warning(f"Failed to link boarding request for trip {trip.id}: {e}")

        # Notify winning driver — you got the ride
        DispatchService._notify_ws(
            f"notifications_{driver.id}",
            "notification_broadcast",
            {
                "type": "request_accepted",
                "trip_id": str(trip.id),
                "request_id": str(dispatch_request.id),
                "route_name": dispatch_request.route.name,
                "otp": otp,
            },
        )

        # Notify ALL OTHER drivers — dismiss popup
        for driver_id_str in dispatch_request.notified_drivers:
            if str(driver.id) != driver_id_str:
                DispatchService._notify_ws(
                    f"notifications_{driver_id_str}",
                    "notification_broadcast",
                    {
                        "type": "request_cancelled",
                        "request_id": str(dispatch_request.id),
                        "reason": "accepted_by_other",
                    },
                )

        # Notify passenger via dispatch WS — driver found
        DispatchService._notify_ws(
            f"dispatch_{trip.id}",
            "dispatch_update",
            {
                "trip_id": str(trip.id),
                "status": trip.status,
                "driver_name": _user_display_name(driver),
                "vehicle_number": vehicle_state.vehicle.vehicle_number,
                "otp": otp,
                "requested_at": timezone.now().isoformat(),
            },
        )

        # Compute distance from driver to pickup for passenger display
        dist_km = None
        eta = None
        if vehicle_state.current_location and dispatch_request.pickup_lat:
            driver_loc = (vehicle_state.current_location.y, vehicle_state.current_location.x)
            pickup_loc = (dispatch_request.pickup_lat, dispatch_request.pickup_lng)
            dist_km = round(geopy_distance(driver_loc, pickup_loc).km, 2)
            eta = max(1, round(dist_km / 30 * 60))  # ~30 km/h avg city speed

        # Compute pickup/drop metadata for the passenger so the map can
        # render the destination and both screens stay in sync.
        drop_name = dispatch_request.route.end_name or dispatch_request.route.name
        drop_lat = drop_lng = None
        try:
            if dispatch_request.route.path:
                drop_lng, drop_lat = dispatch_request.route.path.coords[-1]
        except Exception:
            pass

        pickup_stop = dispatch_request.pickup_stop
        pickup_lat = pickup_lng = None
        try:
            pickup_lat = pickup_stop.location.y
            pickup_lng = pickup_stop.location.x
        except Exception:
            pass

        # Notify passenger via broadcast WS — driver accepted with OTP
        DispatchService._notify_ws(
            f"broadcast_{dispatch_request.id}",
            "broadcast_update",
            {
                "type": "request_accepted",
                "trip_id": str(trip.id),
                "request_id": str(dispatch_request.id),
                "driver_name": _user_display_name(driver),
                "vehicle_number": vehicle_state.vehicle.vehicle_number,
                "otp": otp,
                "distance_km": dist_km,
                "eta": eta,
                "route_id": str(dispatch_request.route_id),
                "route_name": dispatch_request.route.name,
                "pickup_name": pickup_stop.name if pickup_stop else None,
                "pickup_lat": pickup_lat,
                "pickup_lng": pickup_lng,
                "drop_name": drop_name,
                "drop_lat": drop_lat,
                "drop_lng": drop_lng,
            },
        )

        logger.info(
            f"Broadcast dispatch {request_id} accepted by driver {driver.id} → trip {trip.id}"
        )

        return {
            "status": "accepted",
            "trip_id": str(trip.id),
            "driver_name": _user_display_name(driver),
            "otp": otp,
        }

    @staticmethod
    @transaction.atomic
    def _accept_journey_request(
        dispatch_request: DispatchRequest, driver: User
    ) -> Dict[str, Any]:
        """
        Accept a stop-scoped request onto the driver's existing journey.

        The claim on the DispatchRequest has already been won by the caller, so
        this runs only for the single winning driver. It must therefore never
        leave the request accepted with nobody on board: every early return
        releases the claim so the request goes back to the pool.

        Differences from the route accept:

        * no new ActiveTrip. The driver's journey is already ACTIVE and its path
          in Redis already serves the pickup stop; the passenger joins it as a
          BoardingRequest with its own OTP.
        * a journey serves many passengers, so "already on this trip" is a
          normal state rather than a conflict, and the safety code is
          per-boarding.
        """
        def _release(message: str) -> Dict[str, Any]:
            dispatch_request.status = DispatchRequest.STATUS_PENDING
            dispatch_request.accepted_by = None
            dispatch_request.save(update_fields=["status", "accepted_by"])
            return {"status": "no_vehicle", "message": message}

        vehicle = Vehicle.objects.select_related("city").filter(
            driver=driver, is_active=True
        ).first()
        if not vehicle:
            return _release("No active vehicle found for this driver")

        trip = ActiveTrip.objects.select_related("vehicle").filter(
            vehicle=vehicle,
            status=TRIP_STATUS_ACTIVE,
            route__isnull=True,
        ).first()

        if not trip:
            # The driver was offered this because a journey of theirs passed the
            # stop; that journey has since ended. Put the request back rather
            # than inventing a trip, which would have no path.
            return _release("Your journey is no longer active")

        # The journey must still actually serve this stop. The passing-trip set
        # is written once at journey start and cleared on end, but a journey can
        # have ended between the broadcast and this accept without the key
        # expiring, so the claim is re-verified against the trip itself.
        from tracking.services.journey_cache_service import JourneyCacheService

        if not JourneyCacheService.journey_serves_stop(
            str(trip.id), str(dispatch_request.pickup_stop_id)
        ):
            return _release("This stop is no longer on your journey")

        if dispatch_request.drop_stop_id and not CorridorService.is_drop_after_pickup(
            str(trip.id),
            dispatch_request.pickup_stop_id,
            dispatch_request.drop_stop_id,
        ):
            return _release("The destination is not ahead of you on this journey")

        otp = f"{random.randint(1000, 9999)}"
        boarding = DispatchService._create_boarding_request(
            dispatch_request=dispatch_request,
            trip=trip,
            otp=otp,
        )
        if boarding is None:
            return _release("Could not create the booking")

        # A journey outlasts the default key TTL when it keeps taking riders, so
        # an accepted boarding pushes the documents' expiry out.
        JourneyCacheService.refresh_ttl(str(trip.id))

        pickup_stop = dispatch_request.pickup_stop
        drop_stop = dispatch_request.drop_stop

        # Winner gets the boarding and its safety code.
        DispatchService._notify_ws(
            f"notifications_{driver.id}",
            "notification_broadcast",
            {
                "type": "request_accepted",
                "trip_id": str(trip.id),
                "boarding_request_id": str(boarding.id),
                "request_id": str(dispatch_request.id),
                "pickup_name": pickup_stop.name if pickup_stop else None,
                "otp": otp,
                # Driver-side identity, matching the accept response so the
                # card renders from either source.
                "passenger_name": _passenger_display_name(dispatch_request),
                "passenger_phone": _passenger_phone(dispatch_request),
            },
        )

        # Everyone else who was offered it drops the popup.
        for driver_id_str in dispatch_request.notified_drivers or []:
            if str(driver.id) != driver_id_str:
                DispatchService._notify_ws(
                    f"notifications_{driver_id_str}",
                    "notification_broadcast",
                    {
                        "type": "request_cancelled",
                        "request_id": str(dispatch_request.id),
                        "reason": "accepted_by_other",
                    },
                )

        # Passenger learns who is coming. Distance/ETA are measured against the
        # vehicle, which for a journey may already be past the stop - the
        # passenger can then decide to wait for the next one.
        vehicle_state = VehicleState.objects.filter(vehicle=vehicle).first()
        dist_km = None
        eta = None
        if vehicle_state and vehicle_state.current_location and pickup_stop:
            driver_loc = (
                vehicle_state.current_location.y,
                vehicle_state.current_location.x,
            )
            pickup_loc = (pickup_stop.location.y, pickup_stop.location.x)
            dist_km = round(geopy_distance(driver_loc, pickup_loc).km, 2)
            eta = max(1, round(dist_km / 30 * 60))

        journey = JourneyCacheService.get_journey(str(trip.id)) or {}

        # Driver contact/rating for the passenger's arrival screen. Read from the
        # driver's profile, matching where the passenger registered their number.
        driver_profile = getattr(driver, "driver_profile", None)

        DispatchService._notify_ws(
            f"broadcast_{dispatch_request.id}",
            "broadcast_update",
            {
                "type": "request_accepted",
                "trip_id": str(trip.id),
                "boarding_request_id": str(boarding.id),
                "request_id": str(dispatch_request.id),
                "driver_name": _user_display_name(driver),
                "vehicle_number": vehicle.vehicle_number,
                "otp": otp,
                "distance_km": dist_km,
                "eta": eta,
                "pickup_stop_id": str(dispatch_request.pickup_stop_id),
                "pickup_name": pickup_stop.name if pickup_stop else None,
                "pickup_lat": pickup_stop.location.y if pickup_stop else None,
                "pickup_lng": pickup_stop.location.x if pickup_stop else None,
                "drop_stop_id": (
                    str(dispatch_request.drop_stop_id) if drop_stop else None
                ),
                "drop_name": drop_stop.name if drop_stop else None,
                "origin": journey.get("origin"),
                "destination": journey.get("destination"),
                # The passenger's arrival screen needs these to render who is
                # coming and to let them open the trip socket for live position.
                "vehicle_id": str(vehicle.id),
                "vehicle_type": vehicle.vehicle_type,
                "driver_rating": (
                    float(driver_profile.rating) if driver_profile else None
                ),
                "driver_phone": (
                    (driver_profile.phone_number if driver_profile else "") or ""
                ),
            },
        )

        DispatchService._notify_ws(
            f"stop_{dispatch_request.pickup_stop_id}",
            "stop_vehicle_update",
            {
                "type": "vehicle_boarded_passenger",
                "stop_id": str(dispatch_request.pickup_stop_id),
                "trip_id": str(trip.id),
                "vehicle_id": str(vehicle.id),
            },
        )

        logger.info(
            "Journey request %s accepted by driver %s → journey %s (boarding %s)",
            dispatch_request.id,
            driver.id,
            trip.id,
            boarding.id,
        )

        # The driver's view of who they just picked up. Without this the driver
        # only sees a pickup stop name and an OTP, with nothing to match the
        # person standing there against.
        passenger = dispatch_request.passenger
        passenger_rating = getattr(
            getattr(passenger, "driver_profile", None), "rating", None
        )

        return {
            "status": "accepted",
            "trip_id": str(trip.id),
            "boarding_request_id": str(boarding.id),
            "driver_name": _user_display_name(driver),
            "otp": otp,
            # Passenger identity for the driver's accepted-rider card.
            "passenger_id": str(passenger.id),
            "passenger_name": _passenger_display_name(dispatch_request),
            "passenger_phone": _passenger_phone(dispatch_request),
            "passenger_rating": passenger_rating,
            "pickup_stop_id": str(dispatch_request.pickup_stop_id),
            "pickup_stop_name": pickup_stop.name if pickup_stop else None,
            "drop_stop_id": (
                str(dispatch_request.drop_stop_id) if drop_stop else None
            ),
            "drop_stop_name": drop_stop.name if drop_stop else None,
            "distance_km": dist_km,
            "eta_minutes": eta,
            "vehicle_number": vehicle.vehicle_number,
        }

    @staticmethod
    def _create_boarding_request(
        dispatch_request: DispatchRequest,
        trip: ActiveTrip,
        otp: str,
    ) -> Optional[BoardingRequest]:
        """
        Link a passenger to a trip. Returns None if the link cannot be made.

        Failure is returned rather than raised because the caller's claim on the
        dispatch request has to be released; letting this raise would leave a
        request marked accepted with the passenger never attached.

        The insert runs in its own savepoint. Without it, catching the
        ``IntegrityError`` from ``unique_pending_boarding_request`` (the
        passenger already has a pending boarding on this trip) would still leave
        the enclosing transaction unusable: a constraint violation aborts the
        transaction even when the exception is caught, so the caller's release
        save() then failed with
        "An error occurred in the current transaction. You can't execute
        queries until the end of the 'atomic' block." and the driver got a 500
        instead of being told the passenger was already on their way.
        """
        try:
            with transaction.atomic():
                return BoardingRequest.objects.create(
                    passenger=dispatch_request.passenger,
                    trip=trip,
                    pickup_stop=dispatch_request.pickup_stop,
                    drop_stop=dispatch_request.drop_stop,
                    status=BOARDING_PENDING,
                    otp=otp,
                )
        except Exception as exc:
            logger.warning(
                "Failed to link boarding request %s to trip %s: %s",
                dispatch_request.id,
                trip.id,
                exc,
            )
            return None

    @staticmethod
    def find_candidates_for_stop(
        stop_id: str,
        exclude_drivers: Optional[set] = None,
        limit: int = 5,
    ) -> List[Dict[str, Any]]:
        """
        Drivers whose current journey passes a global stop.

        The candidate set is the reverse index built at journey start
        (``vayy:stop:passing_trips``), so this is a set lookup rather than a
        spatial search - the corridor was already evaluated against the driver's
        own path. Stops the driver has already gone past are dropped: they
        cannot still pick the passenger up.

        Returns the same candidate shape as ``find_best_candidates`` so the
        broadcast path treats both sources identically.
        """
        from tracking.services.journey_cache_service import JourneyCacheService

        trip_ids = JourneyCacheService.get_passing_trips(stop_id)
        if not trip_ids:
            return []

        trips = ActiveTrip.objects.filter(
            id__in=trip_ids,
            status=TRIP_STATUS_ACTIVE,
            route__isnull=True,
        ).select_related(
            "vehicle", "vehicle__driver", "vehicle__driver__driver_profile",
            "vehicle__state",
        )

        candidates: List[Dict[str, Any]] = []
        for trip in trips:
            driver = trip.vehicle.driver
            if driver is None:
                continue
            if exclude_drivers and str(driver.id) in exclude_drivers:
                continue

            try:
                profile = driver.driver_profile
            except Exception:
                continue

            state = trip.vehicle.state
            progress = CorridorService.progress_m(
                str(trip.id),
                location=(
                    (state.current_location.x, state.current_location.y)
                    if state and state.current_location
                    else None
                ),
            )
            # Already past the stop: cannot serve a hand raised there.
            if not CorridorService.is_stop_ahead(str(trip.id), stop_id, progress):
                continue

            # Straight-line distance from the vehicle to the stop. Whether the
            # stop is genuinely on the way is expressed by passing-trip
            # membership, not by this number.
            from transport.models import Stop

            stop = Stop.objects.filter(id=stop_id).only("location").first()
            distance_km = None
            if state and state.current_location and stop:
                distance_km = round(
                    geopy_distance(
                        (state.current_location.y, state.current_location.x),
                        (stop.location.y, stop.location.x),
                    ).km,
                    2,
                )

            # Same scoring shape and scale as find_best_candidates, so a journey
            # and a route request rank candidates the same way.
            dist_score = (
                max(0, 50 - (distance_km * 5)) if distance_km is not None else 0
            )
            rating_score = profile.rating * 6

            candidates.append({
                "vehicle": trip.vehicle,
                "driver": driver,
                "trip": trip,
                "score": dist_score + rating_score,
                "distance": distance_km if distance_km is not None else 0,
            })

        candidates.sort(key=lambda c: c["score"], reverse=True)
        return candidates[:limit]

    @staticmethod
    def dismiss_broadcast_request(request_id: str, driver: User) -> Dict[str, Any]:
        """
        Driver explicitly rejects/dismisses a broadcast request.

        Previously a no-op that only logged, so a dismissal was never
        recorded and the expiry cascade's fallback stage would re-notify the
        same driver every 45s. The dismissal is now persisted on the request
        and read by every later round.

        The driver is deliberately left in ``notified_drivers``: that list is
        the authoritative record of who was offered the ride (the accept guard
        and the post-accept sweep both read it), and shrinking it would make
        "I was offered this" unanswerable for a late accept.
        """
        try:
            with transaction.atomic():
                dispatch_request = DispatchRequest.objects.select_for_update().get(
                    id=request_id
                )
                notified = {str(d) for d in (dispatch_request.notified_drivers or [])}
                # Same check the accept path makes. Dismissal used to be a
                # no-op so this was cosmetic; now that it is persisted, a
                # driver who was never offered the ride could otherwise
                # suppress it for everyone else who was.
                if str(driver.id) not in notified:
                    raise PermissionDenied(
                        "This dispatch request was not offered to you"
                    )
                dismissed = {str(d) for d in (dispatch_request.dismissed_drivers or [])}
                dismissed.add(str(driver.id))
                if dismissed != {str(d) for d in dispatch_request.dismissed_drivers}:
                    dispatch_request.dismissed_drivers = list(dismissed)
                    dispatch_request.save(update_fields=["dismissed_drivers"])
        except DispatchRequest.DoesNotExist:
            logger.warning(
                f"Driver {driver.id} dismissed unknown broadcast request {request_id}"
            )
            return {"status": "not_found"}

        logger.info(f"Driver {driver.id} dismissed broadcast request {request_id}")
        return {"status": "dismissed", "request_id": request_id}

    @staticmethod
    def re_dispatch(trip_id: str):
        """
        Attempts to find a new driver for a trip that was rejected or timed out.
        """
        try:
            old_trip = ActiveTrip.objects.get(id=trip_id)
            if old_trip.status not in [TRIP_STATUS_REJECTED, TRIP_STATUS_CANCELLED]:
                return

            logger.info(f"Re-dispatching for trip {trip_id}")
            # Find next best candidate (excluding the one who just rejected)
            # This requires a more complex selector, but for now we re-trigger request_dispatch
            # In a real app, we'd pass the rejected_driver_id to exclude it.
            pass
        except ActiveTrip.DoesNotExist:
            pass

    @staticmethod
    def find_best_candidates(route_id: str, pickup_stop_id: str, limit: int = 5, exclude_drivers: set = None) -> List[Dict[str, Any]]:
        """
        Matching Engine: Two-stage spatial filter + OSRM scoring.
        Stage 1: Redis GEO sub-millisecond radius query (3km, fallback 5km).
        Stage 2: DB lookup for candidate details + OSRM distance matrix.
        """
        from transport.models import Stop
        stop = Stop.objects.get(id=pickup_stop_id)

        # Stage 1: Redis GEO pre-filter (sub-millisecond)
        nearby = RedisGeoService.get_nearby(
            lat=stop.location.y,
            lng=stop.location.x,
            radius_m=3000,
        )
        if len(nearby) < 3:
            # Expand to 5km if too few candidates
            nearby = RedisGeoService.get_nearby(
                lat=stop.location.y,
                lng=stop.location.x,
                radius_m=5000,
            )

        if not nearby:
            return []

        vehicle_ids = [v["vehicle_id"] for v in nearby]

        # Stage 2: DB lookup for candidate details (filtered to Redis results only)
        available_vehicles = VehicleState.objects.filter(
            vehicle_id__in=vehicle_ids,
            occupancy_count=0,
            active_trip__isnull=True,
            current_location__isnull=False,
        ).annotate(
            distance=Distance('current_location', stop.location)
        ).select_related('vehicle', 'vehicle__driver', 'vehicle__driver__driver_profile')

        vehicle_states = list(available_vehicles)

        if not vehicle_states:
            return []

        # Stage 3: OSRM distance matrix on pre-filtered set
        road_distances = {}
        vehicle_coords = [
            (s.current_location.x, s.current_location.y)
            for s in vehicle_states if s.current_location
        ]

        if vehicle_coords:
            try:
                from transport.services.osrm_service import OSRMService
                stop_coord = (stop.location.x, stop.location.y)
                all_coords = vehicle_coords + [stop_coord]
                sources = list(range(len(vehicle_coords)))
                destinations = [len(vehicle_coords)]
                matrix = OSRMService.get_distance_matrix(
                    all_coords, sources=sources, destinations=destinations
                )
                if matrix and matrix.get("distances"):
                    for i, state in enumerate(vehicle_states):
                        if state.current_location and i < len(matrix["distances"]):
                            dist_m = matrix["distances"][i][0]
                            if dist_m is not None:
                                road_distances[state.id] = dist_m / 1000.0
            except Exception as e:
                logger.warning(f"OSRM matrix failed, falling back to haversine: {e}")

        # Stage 4: Score and rank candidates
        candidates = []
        for state in vehicle_states:
            driver = state.vehicle.driver

            # Skip drivers in exclusion list
            if exclude_drivers and str(driver.id) in exclude_drivers:
                continue

            try:
                profile = driver.driver_profile
            except Exception:
                continue

            if state.id in road_distances:
                dist_km = road_distances[state.id]
            else:
                dist_km = state.distance.km * 1.35  # haversine with urban routing multiplier

            # Hard cap: >3km gets 0 points (unprofitable for bike taxis)
            if dist_km > 3.0:
                dist_score = 0
            else:
                dist_score = max(0, 50 - (dist_km * 5))

            # Rating: Max 30 points (5.0 = 30, 0.0 = 0)
            rating_score = profile.rating * 6

            # Route compatibility: Max 10 points (if city matches)
            route_score = 10 if state.vehicle.city_id == stop.route.city_id else 0

            # Total
            total_score = dist_score + rating_score + route_score

            candidates.append({
                'vehicle': state.vehicle,
                'driver': driver,
                'score': total_score,
                'distance': dist_km,
            })

        # Rank by score descending
        candidates.sort(key=lambda x: x['score'], reverse=True)
        return candidates[:limit]

    @staticmethod
    @transaction.atomic
    def update_trip_status(
        trip_id: str,
        new_status: str,
        driver: Optional[User] = None,
        schedule_settlement_retry: bool = True,
    ) -> ActiveTrip:
        """
        Strict State Machine for trip transitions.
        """
        trip = ActiveTrip.objects.select_for_update().get(id=trip_id)
        
        if driver and trip.driver != driver:
            raise PermissionDenied("You are not the assigned driver for this trip")

        valid_transitions = {
            TRIP_STATUS_ASSIGNED: [TRIP_STATUS_ACCEPTED, TRIP_STATUS_REJECTED, TRIP_STATUS_CANCELLED],
            TRIP_STATUS_ACCEPTED: [TRIP_STATUS_ARRIVED, TRIP_STATUS_CANCELLED],
            TRIP_STATUS_ARRIVED: [TRIP_STATUS_ACTIVE, TRIP_STATUS_CANCELLED],
            TRIP_STATUS_ACTIVE: [TRIP_STATUS_COMPLETED, TRIP_STATUS_CANCELLED],
            # Reaching COMPLETED again is how the retry task re-drives an
            # unfinished settlement. The self-transition is a deliberate no-op
            # once the retry budget is spent.
            TRIP_STATUS_PARTIALLY_SETTLED: [TRIP_STATUS_COMPLETED, TRIP_STATUS_PARTIALLY_SETTLED],
        }

        if new_status not in valid_transitions.get(trip.status, []):
            from common.middleware import get_correlation_id
            corr_id = get_correlation_id()
            raise ValueError(
                f"Invalid transition {trip.status} → {new_status} "
                f"[trip={trip_id}, corr_id={corr_id}]"
            )

        requested_status = new_status
        trip.status = new_status

        if new_status in (TRIP_STATUS_COMPLETED, TRIP_STATUS_PARTIALLY_SETTLED):
            trip.ended_at = timezone.now()
            settlement = DispatchService._process_trip_settlement(trip)

            if settlement["outstanding"]:
                # A partial failure must never be reported as a clean finish.
                trip.status = TRIP_STATUS_PARTIALLY_SETTLED
            elif new_status == TRIP_STATUS_PARTIALLY_SETTLED:
                # The retry cleared the backlog.
                trip.status = TRIP_STATUS_COMPLETED

            if trip.status != requested_status:
                logger.error(
                    "Trip %s settlement incomplete: %d/%d passengers outstanding [%s]. "
                    "Trip recorded as %s instead of %s.",
                    trip_id,
                    len(settlement["outstanding"]),
                    settlement["total"],
                    ", ".join(item["reference"] for item in settlement["outstanding"]),
                    trip.status,
                    requested_status,
                )

        if trip.status in (
            TRIP_STATUS_COMPLETED,
            TRIP_STATUS_PARTIALLY_SETTLED,
            TRIP_STATUS_CANCELLED,
            TRIP_STATUS_REJECTED,
        ):
            trip.ended_at = trip.ended_at or timezone.now()
            # Free vehicle state
            state, _ = VehicleState.objects.get_or_create(vehicle=trip.vehicle)
            state.active_trip = None
            state.save()
            # Remove vehicle from Redis GEO set
            try:
                RedisGeoService.remove_vehicle(str(trip.vehicle_id))
            except Exception:
                pass

        trip.save()

        # Queue the retry only once the transaction actually commits, otherwise
        # a worker can pick up a trip whose settlement was rolled back.
        if trip.status == TRIP_STATUS_PARTIALLY_SETTLED and schedule_settlement_retry:
            trip_id_for_retry = str(trip.id)
            transaction.on_commit(
                lambda: DispatchService._enqueue_settlement_retry(trip_id_for_retry)
            )

        payload = {
            "trip_id": str(trip.id),
            "status": trip.status,
            "updated_at": timezone.now().isoformat()
        }

        # Notify
        DispatchService._notify_ws(f"dispatch_{trip.id}", "dispatch_update", payload)
        # dispatch.direct is a DIRECT exchange, so it has no wildcards: a key
        # built from trip.status ("dispatch.arrived", "dispatch.completed", ...)
        # matched no binding and the broker discarded every one of them. Use the
        # fixed dispatch.event key; status travels in the payload.
        RabbitMQService.publish(exchange=EXCHANGE_DISPATCH, routing_key=RK_DISPATCH_EVENT, payload=payload)

        return trip

    @staticmethod
    def _enqueue_settlement_retry(trip_id: str) -> None:
        """
        Import lazily and swallow broker errors: the caller has already
        committed, so a failed enqueue must not roll the trip back. A periodic
        sweep task is the safety net for anything lost here.
        """
        from operations.tasks import settle_trip_settlement

        try:
            settle_trip_settlement.delay(trip_id)
        except Exception:
            logger.exception(
                "Could not enqueue settlement retry for trip %s; it will stay "
                "partially_settled until the periodic sweep picks it up.",
                trip_id,
            )

    @staticmethod
    def _process_trip_settlement(trip: ActiveTrip) -> Dict[str, Any]:
        """
        Handles financial settlement for all passengers on the trip.
        Calculates per-passenger fare based on their actual pickup and drop stops.

        Runs inside the caller's ``transaction.atomic`` block (see
        ``update_trip_status``), so the trip transition and the money movement
        commit or roll back together.

        Per-passenger failures are *collected, not raised*: one underfunded
        passenger must not strand the others. The caller uses ``outstanding``
        to downgrade the trip to ``partially_settled`` and schedule a retry, so
        the revenue is recovered instead of being lost with a swallowed
        ``logger.error``.
        """
        vehicle_type = trip.vehicle.vehicle_type if trip.vehicle else VEHICLE_BIKE
        route_name = trip.route.name if trip.route_id and trip.route else None

        # Snapshot the queryset: settlement mutates request.status, and we need
        # a stable list plus the total for accurate reporting.
        boarding_requests = list(
            BoardingRequest.objects.filter(trip=trip, status=BOARDING_BOARDED)
            .select_related("passenger", "pickup_stop", "drop_stop")
        )

        settled: List[Dict[str, Any]] = []
        outstanding: List[Dict[str, Any]] = []

        for request in boarding_requests:
            # Idempotency key: one logical settlement per passenger per trip.
            # Previously every passenger shared f"trip_{trip.id}", so a retry
            # could not tell whose fare had already been taken.
            reference = f"trip_{trip.id}:p{request.id}"

            try:
                # Calculate fare for this passenger's specific segment
                passenger_fare = RideService.calculate_segment_fare(
                    request.pickup_stop, request.drop_stop, vehicle_type
                )
                fare_decimal = Decimal(str(passenger_fare)).quantize(Decimal("0.01"))

                result = WalletService.settle_debit(
                    sender=request.passenger,
                    receiver=trip.driver,
                    amount=fare_decimal,
                    reference=reference,
                    metadata={
                        "trip_id": str(trip.id),
                        "boarding_request_id": str(request.id),
                        "route": route_name,
                    },
                )
            except Exception as exc:
                # Infrastructure failure (DB/network). No PENDING row survives a
                # rolled-back savepoint, but the trip is now partially settled,
                # which is what drives the retry.
                logger.exception(
                    "Failed to settle payment for passenger %s on trip %s: %s",
                    request.passenger_id, trip.id, exc,
                )
                outstanding.append({
                    "reference": reference,
                    "boarding_request_id": str(request.id),
                    "passenger_id": str(request.passenger_id),
                    "reason": "exception",
                    "error": str(exc),
                })
                continue

            if not result["settled"]:
                # Business failure: settle_debit already persisted a FAILED
                # Transaction for this reference recording what is owed.
                outstanding.append({
                    "reference": reference,
                    "boarding_request_id": str(request.id),
                    "passenger_id": str(request.passenger_id),
                    "amount": str(fare_decimal),
                    "reason": result["error"],
                    "error": result["error"],
                })
                logger.warning(
                    "Outstanding settlement for passenger %s on trip %s: %s",
                    request.passenger_id, trip.id, result["error"],
                )
                continue

            request.status = BOARDING_COMPLETED
            request.save(update_fields=["status", "updated_at"])

            settled.append({
                "reference": reference,
                "boarding_request_id": str(request.id),
                "passenger_id": str(request.passenger_id),
                "amount": str(fare_decimal),
                "already_settled": result["already_settled"],
            })

            if result["already_settled"]:
                # Money moved on an earlier attempt; don't re-notify.
                continue

            NotificationService.create(
                user=request.passenger,
                title="Ride Completed",
                message=f"Your fuel share of {passenger_fare} has been deducted from your wallet.",
                metadata={"trip_id": str(trip.id), "fare": passenger_fare}
            )

        return {
            "total": len(boarding_requests),
            "settled": settled,
            "outstanding": outstanding,
        }

    @staticmethod
    def settle_journey_passengers(trip: ActiveTrip) -> Dict[str, Any]:
        """
        Settle every boarded passenger on a finished journey.

        Structurally the same as ``_process_trip_settlement`` — one debit per
        boarded passenger, failures collected rather than raised so one
        underfunded rider cannot strand the rest — but it differs in two ways
        that matter for journeys:

        * the per-passenger fare is measured along the journey between the
          passenger's own pickup and drop stops, not over a route segment;
        * the settlement runs when the *driver* ends the journey, which may be
          long after the passenger boarded, so a retried settle must not double
          charge. ``BoardingRequest`` carries the idempotency key per rider.

        Returns the same {total, settled, outstanding} shape as the route path.
        """
        vehicle_type = trip.vehicle.vehicle_type if trip.vehicle else VEHICLE_BIKE
        route_label = trip.journey_label if trip.is_journey else (
            trip.route.name if trip.route_id else None
        )

        boarding_requests = list(
            BoardingRequest.objects.filter(trip=trip, status=BOARDING_BOARDED)
            .select_related("passenger", "pickup_stop", "drop_stop")
        )

        settled: List[Dict[str, Any]] = []
        outstanding: List[Dict[str, Any]] = []

        for request in boarding_requests:
            # One logical settlement per passenger per trip, so a retry of this
            # whole method can tell what has already been charged.
            reference = f"trip_{trip.id}:p{request.id}"

            try:
                # One estimate drives both the charge and what the fare screens
                # display, so a rider can never be shown a distance that does
                # not match the fare they were billed.
                segment = RideService.calculate_segment_metrics(
                    request.pickup_stop,
                    request.drop_stop,
                    vehicle_type,
                )
                fare_decimal = Decimal(
                    str(segment["fare"])
                ).quantize(Decimal("0.01"))

                result = WalletService.settle_debit(
                    sender=request.passenger,
                    receiver=trip.driver,
                    amount=fare_decimal,
                    reference=reference,
                    metadata={
                        "trip_id": str(trip.id),
                        "boarding_request_id": str(request.id),
                        "route": route_label,
                        "journey": trip.is_journey,
                        "segment_distance_m": segment["distance_m"],
                        "segment_duration_s": segment["duration_s"],
                    },
                )
            except Exception as exc:
                logger.exception(
                    "Failed to settle journey passenger %s on trip %s: %s",
                    request.passenger_id, trip.id, exc,
                )
                outstanding.append({
                    "reference": reference,
                    "boarding_request_id": str(request.id),
                    "passenger_id": str(request.passenger_id),
                    "reason": "exception",
                    "error": str(exc),
                })
                continue

            if not result["settled"]:
                outstanding.append({
                    "reference": reference,
                    "boarding_request_id": str(request.id),
                    "passenger_id": str(request.passenger_id),
                    "amount": str(fare_decimal),
                    "reason": result["error"],
                    "error": result["error"],
                })
                logger.warning(
                    "Outstanding journey settlement for passenger %s on trip %s: %s",
                    request.passenger_id, trip.id, result["error"],
                )
                continue

            request.status = BOARDING_COMPLETED
            # Persist what this rider was actually charged, so the fare screens
            # read a stored figure instead of recomputing from stops that may be
            # edited later. Written on the already-settled path too, so a retry
            # backfills the record rather than leaving it blank.
            request.segment_distance_m = segment["distance_m"]
            request.segment_duration_s = segment["duration_s"]
            request.fare = fare_decimal
            request.dropped_off_at = timezone.now()
            request.save(update_fields=[
                "status",
                "segment_distance_m",
                "segment_duration_s",
                "fare",
                "dropped_off_at",
                "updated_at",
            ])

            settled.append({
                "reference": reference,
                "boarding_request_id": str(request.id),
                "passenger_id": str(request.passenger_id),
                "amount": str(fare_decimal),
                "already_settled": result["already_settled"],
                # Carried into the end_journey response so the driver's fare
                # screen renders without a second round trip.
                "passenger_name": _user_display_name(request.passenger),
                "pickup_stop_name": request.pickup_stop.name if request.pickup_stop else "",
                "drop_stop_name": request.drop_stop.name if request.drop_stop else "",
                "segment_distance_m": segment["distance_m"],
                "segment_duration_s": segment["duration_s"],
                "fare": float(fare_decimal),
            })

            if result["already_settled"]:
                continue

            NotificationService.create(
                user=request.passenger,
                title="Ride Completed",
                message=(
                    f"Your share of the journey ({fare_decimal}) has been "
                    "deducted from your wallet."
                ),
                metadata={
                    "trip_id": str(trip.id),
                    "boarding_request_id": str(request.id),
                    "fare": float(fare_decimal),
                    "segment_distance_m": segment["distance_m"],
                    "segment_duration_s": segment["duration_s"],
                },
            )

        return {
            "total": len(boarding_requests),
            "settled": settled,
            "outstanding": outstanding,
        }


    @staticmethod
    def accept_assignment(trip_id: str, driver: User):
        return DispatchService.update_trip_status(trip_id, TRIP_STATUS_ACCEPTED, driver)

    @staticmethod
    def reject_assignment(trip_id: str, driver: User):
        return DispatchService.update_trip_status(trip_id, TRIP_STATUS_REJECTED, driver)

    @staticmethod
    def arrived_at_pickup(trip_id: str, driver: User):
        return DispatchService.update_trip_status(trip_id, TRIP_STATUS_ARRIVED, driver)

    @staticmethod
    def start_trip(trip_id: str, driver: User, otp: str = None):
        trip = ActiveTrip.objects.get(id=trip_id)
        if trip.driver != driver:
            raise ValueError("Not your trip")
        if trip.otp and otp and trip.otp != otp:
            raise ValueError("Invalid Safety Code")
        return DispatchService.update_trip_status(trip_id, TRIP_STATUS_ACTIVE, driver)

    @staticmethod
    def complete_trip(trip_id: str, user: User):
        trip = ActiveTrip.objects.select_related("vehicle", "route").get(id=trip_id)
        # Calculate fare from OSRM if not already set
        if trip.total_fare is None:
            from transport.services.osrm_service import OSRMService
            origin = None
            dest = None

            if trip.is_journey:
                # A journey's distance was measured when it started; its fare is
                # just that distance priced. There are no route stops to take
                # endpoints from.
                if trip.total_distance_m:
                    vtype = trip.vehicle.vehicle_type if trip.vehicle else VEHICLE_BIKE
                    trip.total_fare = FareService.calculate_fare(
                        trip.total_distance_m / 1000, vtype
                    )
                    trip.save(update_fields=["total_fare"])
            else:
                stops = trip.route.stops.all().order_by("order") if trip.route else []
                if stops.count() >= 2:
                    origin_coords = stops.first().location
                    dest_coords = stops.last().location
                    if origin_coords and dest_coords:
                        origin = (origin_coords.x, origin_coords.y)
                        dest = (dest_coords.x, dest_coords.y)
                if origin and dest:
                    dist_m = OSRMService.get_road_distance_m(origin, dest)
                    dur_s = OSRMService.get_road_duration_s(origin, dest)
                    if dist_m and dur_s:
                        trip.total_distance_m = dist_m
                        trip.total_duration_s = dur_s
                        dist_km = dist_m / 1000
                        vtype = trip.vehicle.vehicle_type if trip.vehicle else VEHICLE_BIKE
                        trip.total_fare = FareService.calculate_fare(dist_km, vtype)
                        trip.save(update_fields=["total_distance_m", "total_duration_s", "total_fare"])
        # Update driver stats after status update succeeds
        is_driver = trip.driver == user
        result = DispatchService.update_trip_status(trip_id, TRIP_STATUS_COMPLETED, driver=user if is_driver else None)
        if is_driver:
            profile = user.driver_profile
            profile.total_trips += 1
            profile.save(update_fields=["total_trips"])
        return result

    @staticmethod
    def cancel_dispatch(trip_id: str, user: User, reason: str = "user_cancelled"):
        """
        Cancel a trip on behalf of one of its participants.

        Previously this ignored ``user`` entirely and let any authenticated
        caller cancel any trip by id. The view now enforces ownership with
        HasTripAccess, but the check is repeated here so the rule also holds
        for any other caller of this method.

        Note we deliberately do *not* forward ``user`` as the ``driver``
        argument of ``update_trip_status``: that argument asserts "caller is
        the assigned driver" and would reject the passenger, who is equally
        entitled to withdraw. Authorisation is decided here, once, and
        ``update_trip_status`` is called without a driver.
        """
        trip = ActiveTrip.objects.get(id=trip_id)

        is_driver = trip.driver_id == user.id
        is_passenger = trip.boarding_requests.filter(
            passenger_id=user.id
        ).exists()

        if not is_driver and not is_passenger:
            raise PermissionDenied(
                "You are not a participant in this trip"
            )

        logger.info(
            "Trip %s cancelled by %s (driver=%s): %s",
            trip_id, user.id, is_driver, reason,
        )

        return DispatchService.update_trip_status(trip_id, TRIP_STATUS_CANCELLED)

    @staticmethod 
    def cancel_broadcast_request(request_id: str, user: User) -> Dict[str, Any]:
        """
        Passenger cancels their broadcast dispatch request.
        Notifies all drivers to dismiss the popup.

        The caller must be the passenger who raised the request: without this
        any passenger could cancel somebody else's pending ride request by id,
        which is a denial-of-service on a trip they are not part of.
        """
        dispatch_request = DispatchRequest.objects.get(id=request_id)

        if dispatch_request.passenger_id != user.id:
            raise PermissionDenied(
                "You can only cancel your own dispatch request"
            )

        if dispatch_request.status != DispatchRequest.STATUS_PENDING:
            return {"status": "already_resolved", "message": "Request already resolved"}

        dispatch_request.status = DispatchRequest.STATUS_CANCELLED
        dispatch_request.save()

        # Notify all drivers → dismiss popup
        for driver_id_str in dispatch_request.notified_drivers:
            DispatchService._notify_ws(
                f"notifications_{driver_id_str}",
                "notification_broadcast",
                {
                    "type": "request_cancelled",
                    "request_id": str(dispatch_request.id),
                    "reason": "passenger_cancelled",
                },
            )

        logger.info(f"Broadcast dispatch {request_id} cancelled by passenger {user.id}")
        return {"status": BOARDING_CANCELLED}
