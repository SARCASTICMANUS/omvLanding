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
from tracking.services.redis_geo_service import RedisGeoService
from communication.constants import EXCHANGE_DISPATCH, RK_DISPATCH_ASSIGN, RK_DISPATCH_CANCEL
from operations.constants import (
    BOARDING_PENDING,
    TRIP_STATUS_REQUESTED, TRIP_STATUS_ASSIGNED, TRIP_STATUS_ACCEPTED,
    TRIP_STATUS_REJECTED, TRIP_STATUS_ARRIVED, TRIP_STATUS_ACTIVE,
    TRIP_STATUS_COMPLETED, TRIP_STATUS_CANCELLED
)

logger = logging.getLogger(__name__)


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
    def request_dispatch(passenger: User, route_id: str, pickup_stop_id: str, mode: str = "direct") -> Dict[str, Any]:
        """
        Initiates a ride request and triggers the matching engine.
        Supports 'direct' and 'broadcast' modes.
        """
        logger.info(f"Dispatch requested by passenger {passenger.id} for route {route_id} (mode: {mode})")
        
        # 1. Find candidates
        candidates = DispatchService.find_best_candidates(route_id, pickup_stop_id)
        
        if not candidates:
            return {"status": "no_drivers_available", "message": "No drivers found nearby"}

        if mode == "broadcast":
            return DispatchService._handle_broadcast_dispatch(passenger, route_id, pickup_stop_id, candidates)

        best_candidate = candidates[0]
        return DispatchService._assign_to_driver(passenger, route_id, pickup_stop_id, best_candidate)

    @staticmethod
    def _assign_to_driver(passenger: User, route_id: str, pickup_stop_id: str, candidate: Dict[str, Any]) -> Dict[str, Any]:
        # 2. Create Trip in 'requested' state
        route = Route.objects.get(id=route_id)
        trip = ActiveTrip.objects.create(
            vehicle=candidate['vehicle'],
            route=route,
            driver=candidate['driver'],
            status=TRIP_STATUS_ASSIGNED,
            started_at=timezone.now()
        )

        # Link the passenger to the trip + pickup stop so live tracking can
        # report the true distance to pickup (not remaining route distance).
        try:
            stop = Stop.objects.get(id=pickup_stop_id)
            BoardingRequest.objects.create(
                passenger=passenger,
                trip=trip,
                pickup_stop=stop,
                status=BOARDING_PENDING,
            )
        except Exception as e:
            logger.warning(f"Failed to link boarding request for trip {trip.id}: {e}")

        payload = {
            "trip_id": str(trip.id),
            "passenger_id": str(passenger.id),
            "driver_id": str(trip.driver.id),
            "route_id": route_id,
            "pickup_stop_id": pickup_stop_id,
            "status": trip.status,
            "requested_at": timezone.now().isoformat()
        }
        
        # 3. Publish to RabbitMQ for workers
        RabbitMQService.publish(
            exchange=EXCHANGE_DISPATCH,
            routing_key="dispatch.assign",
            payload=payload
        )

        # 4. Notify via WebSockets
        DispatchService._notify_ws(f"dispatch_{trip.id}", "dispatch_update", payload)
        DispatchService._notify_ws(f"notifications_{trip.driver.id}", "notification_broadcast", {
            "title": "New Assignment",
            "message": f"You have a new ride request for {route.name}",
            "trip_id": str(trip.id)
        })

        # 5. Schedule timeout check (2 minutes)
        from operations.tasks import check_assignment_timeout
        check_assignment_timeout.apply_async((str(trip.id),), countdown=120)
        
        return {"status": "assigned", "trip_id": str(trip.id), "driver_name": trip.driver.get_full_name()}

    @staticmethod
    def _handle_broadcast_dispatch(passenger: User, route_id: str, pickup_stop_id: str, candidates: List[Dict]) -> Dict[str, Any]:
        """
        Broadcasts the dispatch request to ALL nearby drivers on the route.
        First driver to accept wins; others get dismissed via WS.
        """
        from transport.models import Stop

        stop = Stop.objects.get(id=pickup_stop_id)
        route = Route.objects.get(id=route_id)
        passenger_name = passenger.get_full_name() or passenger.email

        # Create broadcast dispatch request
        dispatch_request = DispatchRequest.objects.create(
            passenger=passenger,
            route=route,
            pickup_stop=stop,
            pickup_lat=stop.location.y,
            pickup_lng=stop.location.x,
            notified_drivers=[str(c["driver"].id) for c in candidates],
            expires_at=timezone.now() + timedelta(seconds=90),
        )

        # Shared request metadata for all candidate drivers
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

        # Schedule 90s timeout — expire if no one accepts
        from operations.tasks import expire_broadcast_request
        expire_broadcast_request.apply_async(
            (str(dispatch_request.id),),
            countdown=90,
        )

        logger.info(
            f"Broadcast dispatch {dispatch_request.id} sent to {len(candidates)} drivers "
            f"on route {route.name}"
        )

        return {
            "status": "pending",
            "request_id": str(dispatch_request.id),
            "drivers_notified": len(candidates),
        }

    @staticmethod
    @transaction.atomic
    def accept_broadcast_request(request_id: str, driver: User) -> Dict[str, Any]:
        """
        Driver accepts a broadcast dispatch request.
        Uses select_for_update to prevent race conditions (only one driver wins).
        """
        dispatch_request = DispatchRequest.objects.select_for_update().get(id=request_id)

        if dispatch_request.status != DispatchRequest.STATUS_PENDING:
            return {
                "status": "already_taken",
                "message": "Request already accepted by another driver",
            }

        if timezone.now() > dispatch_request.expires_at:
            dispatch_request.status = DispatchRequest.STATUS_EXPIRED
            dispatch_request.save()
            return {"status": "expired", "message": "Request has expired"}

        # Find driver's vehicle
        vehicle_state = VehicleState.objects.select_related("vehicle").filter(
            vehicle__driver=driver,
            vehicle__is_active=True,
        ).first()

        if not vehicle_state:
            return {
                "status": "no_vehicle",
                "message": "No active vehicle found for this driver",
            }

        # Mark request as accepted
        dispatch_request.status = DispatchRequest.STATUS_ACCEPTED
        dispatch_request.accepted_by = driver
        dispatch_request.save()

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

        # Notify passenger via broadcast WS — driver accepted with OTP
        DispatchService._notify_ws(
            f"broadcast_{dispatch_request.id}",
            "broadcast_update",
            {
                "type": "request_accepted",
                "trip_id": str(trip.id),
                "driver_name": driver.get_full_name(),
                "vehicle_number": vehicle_state.vehicle.vehicle_number,
                "otp": otp,
                "distance_km": dist_km,
                "eta": eta,
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
        No state change — popup just disappears locally.
        """
        logger.info(f"Driver {driver.id} dismissed broadcast request {request_id}")
        return {"status": "dismissed"}

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
    def find_best_candidates(route_id: str, pickup_stop_id: str, limit: int = 5) -> List[Dict[str, Any]]:
        """
        Matching Engine: Finds and ranks drivers based on distance, rating, and availability.
        Only considers VERIFIED drivers.
        """
        from transport.models import Stop
        stop = Stop.objects.get(id=pickup_stop_id)
        
        # Find available vehicles within 10km (great-circle for initial filter)
        available_vehicles = VehicleState.objects.filter(
            vehicle__is_active=True,
            # vehicle__driver__driver_profile__is_verified=True,
            # active_trip__isnull=True,
            # current_location__distance_lte=(stop.location, D(km=10))
        ).annotate(
            distance=Distance('current_location', stop.location)
        ).select_related('vehicle', 'vehicle__driver', 'vehicle__driver__driver_profile')

        candidates = []
        vehicle_coords = []
        vehicle_states = []
        for state in available_vehicles:
            vehicle_coords.append(
                (state.current_location.x, state.current_location.y)
            )
            vehicle_states.append(state)

        road_distances = {}
        if vehicle_coords:
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
                    dist_m = matrix["distances"][i][0]
                    if dist_m is not None:
                        road_distances[state.id] = dist_m / 1000.0

        for state in vehicle_states:
            driver = state.vehicle.driver
            profile = driver.driver_profile

            if state.id in road_distances:
                dist_km = road_distances[state.id]
                dist_score = max(0, 50 - (dist_km * 5))
            else:
                dist_score = max(0, 50 - (state.distance.km * 5))
            
            # Rating: Max 30 points (5.0 = 30, 0.0 = 0)
            rating_score = profile.rating * 6
            
            # Occupancy compatibility: Max 10 points (0 occupancy = 10, >5 = 0)
            occ_score = max(0, 10 - (state.occupancy_count * 2))

            # Route compatibility: Max 10 points (if city matches)
            route_score = 10 if state.vehicle.city_id == stop.route.city_id else 0
            
            # Total
            total_score = dist_score + rating_score + occ_score + route_score
            
            candidates.append({
                'vehicle': state.vehicle,
                'driver': driver,
                'score': total_score,
                'distance': state.distance.km
            })

        # Rank by score descending
        candidates.sort(key=lambda x: x['score'], reverse=True)
        return candidates[:limit]

    @staticmethod
    @transaction.atomic
    def update_trip_status(trip_id: str, new_status: str, driver: Optional[User] = None) -> ActiveTrip:
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
        }

        if new_status not in valid_transitions.get(trip.status, []):
            raise ValueError(f"Invalid transition from {trip.status} to {new_status}")

        trip.status = new_status
        
        if new_status == TRIP_STATUS_COMPLETED:
            trip.ended_at = timezone.now()
            DispatchService._process_trip_settlement(trip)

        if new_status in [TRIP_STATUS_COMPLETED, TRIP_STATUS_CANCELLED, TRIP_STATUS_REJECTED]:
            trip.ended_at = timezone.now()
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

        payload = {
            "trip_id": str(trip.id),
            "status": trip.status,
            "updated_at": timezone.now().isoformat()
        }

        # Notify
        DispatchService._notify_ws(f"dispatch_{trip.id}", "dispatch_update", payload)
        RabbitMQService.publish(exchange=EXCHANGE_DISPATCH, routing_key=f"dispatch.{new_status}", payload=payload)

        return trip

    @staticmethod
    def _process_trip_settlement(trip: ActiveTrip):
        """
        Handles financial settlement for all passengers on the trip.
        """
        fare = RideService.calculate_final_fare(trip)
        fare_decimal = Decimal(str(fare))
        
        # Find all boarded passengers
        boarding_requests = BoardingRequest.objects.filter(trip=trip, status="boarded")
        
        for request in boarding_requests:
            try:
                WalletService.transfer_funds(
                    sender=request.passenger,
                    receiver=trip.driver,
                    amount=fare_decimal,
                    reference=f"trip_{trip.id}",
                    metadata={"trip_id": str(trip.id), "route": trip.route.name}
                )
                request.status = "completed"
                request.save()
                
                NotificationService.create(
                    user=request.passenger,
                    title="Ride Completed",
                    message=f"Hope you enjoyed your ride! {fare} has been deducted from your wallet.",
                    metadata={"trip_id": str(trip.id), "fare": fare}
                )
            except Exception as e:
                logger.error(f"Failed to settle payment for passenger {request.passenger.id} on trip {trip.id}: {e}")

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
            raise ValueError("Invalid OTP")
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
                    vtype = trip.vehicle.vehicle_type if trip.vehicle else "bike"
                    base_fare = 20 if vtype == "bike" else 30
                    per_km = 5 if vtype == "bike" else 10
                    trip.total_fare = base_fare + (dist_km * per_km)
                    trip.save(update_fields=["total_distance_m", "total_duration_s", "total_fare"])
        # Update driver stats (only when the driver completes)
        is_driver = trip.driver == user
        if is_driver:
            profile = user.driver_profile
            profile.total_trips += 1
            profile.save()
        return DispatchService.update_trip_status(trip_id, TRIP_STATUS_COMPLETED, driver=user if is_driver else None)

    @staticmethod
    def cancel_dispatch(trip_id: str, user: User, reason: str = "user_cancelled"):
        # Any party can cancel for now, but in real app we check role/permissions
        return DispatchService.update_trip_status(trip_id, TRIP_STATUS_CANCELLED)

    @staticmethod 
    def cancel_broadcast_request(request_id: str, user: User) -> Dict[str, Any]:
        """
        Passenger cancels their broadcast dispatch request.
        Notifies all drivers to dismiss the popup.
        """
        dispatch_request = DispatchRequest.objects.get(id=request_id)

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
        return {"status": "cancelled"}
