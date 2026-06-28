import logging
from decimal import Decimal
from typing import Dict, Any, List, Optional
from django.db import transaction
from django.utils import timezone
from django.contrib.gis.geos import Point
from django.contrib.gis.measure import D
from django.contrib.gis.db.models.functions import Distance
from asgiref.sync import async_to_sync
from channels.layers import get_channel_layer
from rest_framework.exceptions import PermissionDenied

from accounts.models import User, PublicDriverProfile
from operations.models import Vehicle, ActiveTrip, VehicleState, BoardingRequest
from transport.models import Route, TripSchedule
from communication.services.rabbitmq_service import RabbitMQService
from communication.services.notification_service import NotificationService
from accounts.services.wallet_service import WalletService
from operations.services.ride_service import RideService
from communication.constants import EXCHANGE_DISPATCH, RK_DISPATCH_ASSIGN, RK_DISPATCH_CANCEL
from operations.constants import (
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
    def _handle_broadcast_dispatch(passenger: User, route_id: str, pickup_stop_id: str, candidates: List[Dict]):
        """
        In a real app, this would notify all N drivers and the first to accept wins.
        For this prototype, we'll assign to the first and queue the rest as fallback.
        """
        # Logic for real broadcast involves a different model (DispatchSession)
        # to track multiple offers. For now, we reuse the direct assignment
        # but return a broadcast status.
        return DispatchService._assign_to_driver(passenger, route_id, pickup_stop_id, candidates[0])

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
            vehicle__driver__driver_profile__is_verified=True,
            active_trip__isnull=True,
            current_location__distance_lte=(stop.location, D(km=10))
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
    def start_trip(trip_id: str, driver: User):
        return DispatchService.update_trip_status(trip_id, TRIP_STATUS_ACTIVE, driver)

    @staticmethod
    def complete_trip(trip_id: str, driver: User):
        # Update driver stats
        profile = driver.driver_profile
        profile.total_trips += 1
        profile.save()
        return DispatchService.update_trip_status(trip_id, TRIP_STATUS_COMPLETED, driver)

    @staticmethod
    def cancel_dispatch(trip_id: str, user: User, reason: str = "user_cancelled"):
        # Any party can cancel for now, but in real app we check role/permissions
        return DispatchService.update_trip_status(trip_id, TRIP_STATUS_CANCELLED)
