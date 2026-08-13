import logging
import time
from typing import Dict, Any, List, Optional

from operations.models import ActiveTrip, Vehicle, VehicleState, BoardingRequest
from transport.models import Stop, Route
from tracking.services.redis_route_service import RedisRouteService
from tracking.services.redis_geo_service import RedisGeoService
from tracking.services.event_publisher import TrackingEventPublisher

logger = logging.getLogger(__name__)


class MatchingService:
    """
    Multi-stage ride matching:
      1. Filter by route
      2. Filter by direction
      3. Filter by proximity (Redis GEO)
      4. Validate stop sequence (driver_stop < pickup < dropoff)
      5. Rank by ETA / distance to pickup
      6. Publish ride request to best driver's queue
    """

    MAX_PROXIMITY_RADIUS_M = 5000  # how far a driver can be from pickup stop

    # ── public entry point ───────────────────────────────────

    @classmethod
    def find_and_match_driver(cls, ride_request: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        """
        ride_request = {
            "request_id": str,
            "passenger_id": str,
            "route_id": str,
            "pickup_stop_id": str,
            "dropoff_stop_id": str,
            "passenger_lat": float,
            "passenger_lng": float,
        }
        Returns matched driver info dict or None.
        """
        route_id = ride_request["route_id"]
        pickup_stop_id = ride_request["pickup_stop_id"]
        dropoff_stop_id = ride_request["dropoff_stop_id"]
        passenger_lat = ride_request["passenger_lat"]
        passenger_lng = ride_request["passenger_lng"]

        # Resolve stops and validate sequence
        try:
            pickup_stop = Stop.objects.get(id=pickup_stop_id, route_id=route_id)
            dropoff_stop = Stop.objects.get(id=dropoff_stop_id, route_id=route_id)
        except Stop.DoesNotExist:
            logger.error(f"Invalid stops for matching: pickup={pickup_stop_id} drop={dropoff_stop_id}")
            return None

        if pickup_stop.order == dropoff_stop.order:
            logger.warning("Pickup and dropoff stop are the same")
            return None

        # ── Stage 1: Get all vehicles on this route from Redis ─
        all_vehicles = RedisRouteService.get_vehicles_on_route(route_id)
        if not all_vehicles:
            logger.info(f"No vehicles found on route {route_id} in Redis")
            # Fallback: query DB
            all_vehicles = cls._fallback_vehicles_on_route(route_id)

        candidates = []
        for v in all_vehicles:
            vid = v["vehicle_id"]
            v_direction = v.get("direction", "")
            v_stop_index = v.get("stop_index", 0)

            # ── Stage 2: Direction filter ────────────────────
            target_direction = cls._target_direction(pickup_stop.order, dropoff_stop.order)
            if v_direction and v_direction != target_direction:
                continue

            # ── Stage 3: Sequence validation ─────────────────
            # Driver must be at or before the pickup stop
            if not cls._sequence_valid(v_stop_index, pickup_stop.order, dropoff_stop.order):
                continue

            # ── Stage 4: Proximity check ─────────────────────
            state = v.get("state") or {}
            v_lat = state.get("snapped_lat") or state.get("lat")
            v_lng = state.get("snapped_lng") or state.get("lng")

            if v_lat and v_lng:
                from tracking.services.geo_service import GeoService
                dist = GeoService.haversine_m(
                    float(v_lat), float(v_lng), passenger_lat, passenger_lng
                )
                if dist > cls.MAX_PROXIMITY_RADIUS_M:
                    continue
            else:
                dist = 0

            # ── Stage 5: Rank by ETA to pickup ──────────────
            eta_map = RedisRouteService.get_vehicle_etas(vid)
            eta_to_pickup = float("inf")
            if eta_map:
                eta_to_pickup = eta_map.get(pickup_stop_id, float("inf"))

            candidates.append({
                "vehicle_id": vid,
                "stop_index": v_stop_index,
                "direction": v_direction,
                "distance_to_pickup_m": round(dist, 1),
                "eta_to_pickup_s": eta_to_pickup,
                "driver_id": state.get("driver_id", ""),
                "vehicle_number": state.get("vehicle_number", ""),
                "trip_id": state.get("trip_id", ""),
            })

        if not candidates:
            logger.info(f"No matching drivers found for route {route_id}")
            return None

        # Sort: lowest ETA first, then closest distance
        candidates.sort(key=lambda c: (c["eta_to_pickup_s"], c["distance_to_pickup_m"]))
        best = candidates[0]

        logger.info(
            f"Matched driver {best['vehicle_id']} for request {ride_request['request_id']}: "
            f"eta={best['eta_to_pickup_s']}s dist={best['distance_to_pickup_m']}m"
        )

        # ── Stage 6: Publish ride request to driver ──────────
        cls._publish_to_driver(best, ride_request)

        # Store in Redis for lifecycle tracking
        RedisRouteService.add_ride_request(
            trip_id=best.get("trip_id", ""),
            request_id=ride_request["request_id"],
            created_at_ts=time.time(),
            pickup_stop_id=pickup_stop_id,
            dropoff_stop_id=dropoff_stop_id,
        )

        return best

    # ── internal helpers ─────────────────────────────────────

    @staticmethod
    def _target_direction(pickup_order: int, dropoff_order: int) -> str:
        """If pickup.order < dropoff.order, passenger is going outbound."""
        return "outbound" if pickup_order < dropoff_order else "inbound"

    @staticmethod
    def _sequence_valid(
        driver_stop_index: int,
        pickup_order: int,
        dropoff_order: int,
    ) -> bool:
        """
        Driver must be at or before pickup, and pickup must be before dropoff.
        Handles both outbound and inbound.
        """
        if pickup_order < dropoff_order:
            # Outbound: driver_stop <= pickup < dropoff
            return driver_stop_index <= pickup_order
        else:
            # Inbound: driver_stop >= pickup > dropoff
            return driver_stop_index >= pickup_order

    @classmethod
    def _fallback_vehicles_on_route(cls, route_id: str) -> List[Dict[str, Any]]:
        """DB fallback when Redis has no vehicles for the route."""
        active_trips = ActiveTrip.objects.filter(
            route_id=route_id,
            status="active",
        ).select_related("vehicle", "vehicle__driver").prefetch_related("vehicle__state")

        results = []
        for trip in active_trips:
            state = trip.vehicle.state if hasattr(trip.vehicle, "state") else None
            if state and state.current_location:
                results.append({
                    "vehicle_id": str(trip.vehicle.id),
                    "stop_index": state.current_stop_index,
                    "direction": trip.direction,
                    "state": {
                        "lat": state.snapped_location.y if state.snapped_location else state.current_location.y,
                        "lng": state.snapped_location.x if state.snapped_location else state.current_location.x,
                        "snapped_lat": str(state.snapped_location.y) if state.snapped_location else "",
                        "snapped_lng": str(state.snapped_location.x) if state.snapped_location else "",
                        "driver_id": str(trip.vehicle.driver_id) if trip.vehicle.driver_id else "",
                        "vehicle_number": trip.vehicle.vehicle_number,
                        "trip_id": str(trip.id),
                    },
                })
        return results

    @staticmethod
    def _publish_to_driver(driver_info: Dict[str, Any], ride_request: Dict[str, Any]) -> None:
        """Publish ride request to the matched driver's RabbitMQ queue."""
        payload = {
            "event": "ride_request",
            "request_id": ride_request["request_id"],
            "passenger_id": ride_request["passenger_id"],
            "route_id": ride_request["route_id"],
            "pickup_stop_id": ride_request["pickup_stop_id"],
            "dropoff_stop_id": ride_request["dropoff_stop_id"],
            "passenger_lat": ride_request["passenger_lat"],
            "passenger_lng": ride_request["passenger_lng"],
            "vehicle_id": driver_info["vehicle_id"],
            "eta_to_pickup_s": driver_info["eta_to_pickup_s"],
            "distance_to_pickup_m": driver_info["distance_to_pickup_m"],
        }
        try:
            # Publish to the dispatch exchange, routed to the specific vehicle
            from communication.services.rabbitmq_service import RabbitMQService
            from communication.constants import EXCHANGE_DISPATCH, RK_DISPATCH_ASSIGN

            RabbitMQService.publish(
                exchange=EXCHANGE_DISPATCH,
                routing_key=f"dispatch.{driver_info['vehicle_id']}",
                payload=payload,
            )
            logger.info(f"Published ride request {ride_request['request_id']} to vehicle {driver_info['vehicle_id']}")
        except Exception as e:
            logger.error(f"Failed to publish ride request to driver: {e}")

    # ── ride lifecycle transitions ───────────────────────────

    @staticmethod
    def accept_ride(request_id: str, vehicle_id: str) -> bool:
        """Driver accepts the ride request."""
        try:
            # Update boarding request in DB
            boarding = BoardingRequest.objects.get(id=request_id)
            boarding.status = "accepted"
            boarding.save(update_fields=["status", "updated_at"])

            # Broadcast acceptance to passenger
            TrackingEventPublisher.publish_boarding_event({
                "event": "ride_accepted",
                "request_id": str(request_id),
                "vehicle_id": vehicle_id,
            })
            logger.info(f"Ride {request_id} accepted by vehicle {vehicle_id}")
            return True
        except BoardingRequest.DoesNotExist:
            logger.error(f"BoardingRequest {request_id} not found")
            return False

    @staticmethod
    def reject_ride(request_id: str, vehicle_id: str) -> bool:
        """Driver rejects the ride; re-match with next candidate."""
        try:
            boarding = BoardingRequest.objects.get(id=request_id)
            boarding.status = "cancelled"
            boarding.save(update_fields=["status", "updated_at"])

            # Remove from Redis
            RedisRouteService.remove_ride_request(
                trip_id=vehicle_id, request_id=str(request_id)
            )
            logger.info(f"Ride {request_id} rejected by vehicle {vehicle_id}")
            return True
        except BoardingRequest.DoesNotExist:
            return False

    @staticmethod
    def board_passenger(request_id: str) -> bool:
        """Passenger boards the vehicle."""
        try:
            boarding = BoardingRequest.objects.get(id=request_id)
            boarding.status = "boarded"
            boarding.save(update_fields=["status", "updated_at"])

            # Update occupancy
            trip = boarding.trip
            if trip and trip.vehicle:
                state, _ = VehicleState.objects.get_or_create(vehicle=trip.vehicle)
                state.occupancy_count += 1
                state.save(update_fields=["occupancy_count"])

            return True
        except BoardingRequest.DoesNotExist:
            return False

    @staticmethod
    def complete_ride(request_id: str) -> bool:
        """Ride completed (passenger dropped off)."""
        try:
            boarding = BoardingRequest.objects.get(id=request_id)
            boarding.status = "completed"
            boarding.save(update_fields=["status", "updated_at"])

            # Decrement occupancy
            trip = boarding.trip
            if trip and trip.vehicle:
                state, _ = VehicleState.objects.get_or_create(vehicle=trip.vehicle)
                state.occupancy_count = max(0, state.occupancy_count - 1)
                state.save(update_fields=["occupancy_count"])

            # Remove from Redis ride requests
            RedisRouteService.remove_ride_request(
                trip_id=str(trip.id) if trip else "",
                request_id=str(request_id),
            )
            return True
        except BoardingRequest.DoesNotExist:
            return False
