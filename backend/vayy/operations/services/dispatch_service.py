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
        """
        logger.info(f"Dispatch requested by passenger {passenger.id} for route {route_id} (mode: {mode})")
        
        # 1. Find candidates
        candidates = DispatchService.find_best_candidates(route_id, pickup_stop_id)
        
        if not candidates:
            return {"status": "no_drivers_available", "message": "No drivers found nearby"}

        if mode == DISPATCH_MODE_BROADCAST:
            return DispatchService._handle_broadcast_dispatch(passenger, route_id, pickup_stop_id, drop_stop_id, candidates)

        best_candidate = candidates[0]
        return DispatchService._assign_to_driver(passenger, route_id, pickup_stop_id, best_candidate, drop_stop_id)

    @staticmethod
    def _assign_to_driver(passenger: User, route_id: str, pickup_stop_id: str, candidate: Dict[str, Any], drop_stop_id: str = None) -> Dict[str, Any]:
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
        
        return {"status": "assigned", "trip_id": str(trip.id), "driver_name": trip.driver.get_full_name()}

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
    def _handle_broadcast_dispatch(passenger: User, route_id: str, pickup_stop_id: str, drop_stop_id: str, candidates: List[Dict], dispatch_request: Optional[DispatchRequest] = None) -> Dict[str, Any]:
        """
        Broadcasts the dispatch request to ALL nearby drivers on the route.
        First driver to accept wins; others get dismissed via WS.

        When dispatch_request is provided (re-dispatch after expiry), the SAME
        request_id is reused so the passenger's broadcast WS group
        (broadcast_{request_id}) stays valid across all retry rounds.
        """
        from transport.models import Stop

        stop = Stop.objects.get(id=pickup_stop_id)
        route = Route.objects.get(id=route_id)
        passenger_name = passenger.get_full_name() or passenger.email

        # Get drop stop if provided, otherwise fallback to route end
        drop_stop = None
        if drop_stop_id:
            try:
                drop_stop = Stop.objects.get(id=drop_stop_id, route_id=route_id)
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
        else:
            drop_name = route.end_name or route.name
            drop_lat = drop_lng = None
            try:
                if route.path:
                    drop_lng, drop_lat = route.path.coords[-1]
            except Exception:
                pass

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
                    "route_name": route.name,
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
            f"on route {route.name}"
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
                "driver_name": driver.get_full_name(),
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
                "driver_name": driver.get_full_name(),
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
            "driver_name": driver.get_full_name(),
            "otp": otp,
        }

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
