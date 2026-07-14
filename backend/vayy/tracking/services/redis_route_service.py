import json
import logging
from typing import Dict, List, Optional, Any

from django.core.cache import cache

logger = logging.getLogger(__name__)

# ──────────────────────────────────────────────────────────────
# Redis key schema (all TTLs in seconds)
#
# vayy:route:vehicles:{route_id}
#   Sorted Set  – member=vehicle_id, score=stop_index
#   Purpose: fast lookup of all vehicles on a route + direction filter
#   TTL: 180s (refreshed on every GPS ping)
#
# vayy:vehicle:route_state:{vehicle_id}
#   Hash – route_id, direction, current_stop_index, current_segment_index,
#          distance_along_route_m, last_stop_id, eta_to_next_stop_s,
#          snapped_lat, snapped_lng
#   TTL: 180s
#
# vayy:vehicle:etas:{vehicle_id}
#   Hash – stop_id → eta_seconds  (only downstream stops)
#   TTL: 120s
#
# vayy:route:active_trips:{route_id}
#   Set – trip_ids active on this route
#   TTL: 300s
#
# vayy:ride_requests:{trip_id}
#   Sorted Set – member=request_id, score=created_at timestamp
#   Purpose: pending ride requests for a trip
#   TTL: 600s
# ──────────────────────────────────────────────────────────────


class RedisRouteService:
    """
    Redis-backed cache for real-time route-based vehicle state.
    Every write is idempotent and failure-tolerant (logged, never raised).
    """

    # ── helpers ──────────────────────────────────────────────

    @staticmethod
    def _decode(val):
        return val.decode() if isinstance(val, bytes) else val

    @classmethod
    def _client(cls):
        return cache.client.get_client()

    # ── vehicle route-state hash ─────────────────────────────

    VEHICLE_STATE_KEY = "vayy:vehicle:route_state"
    VEHICLE_STATE_TTL = 180

    @classmethod
    def _state_key(cls, vehicle_id: str) -> str:
        return f"{cls.VEHICLE_STATE_KEY}:{vehicle_id}"

    @classmethod
    def set_vehicle_route_state(
        cls,
        vehicle_id: str,
        route_id: str,
        direction: str,
        current_stop_index: int,
        current_segment_index: int,
        distance_along_route_m: float,
        last_stop_id: Optional[str] = None,
        eta_to_next_stop_s: Optional[float] = None,
        snapped_lat: Optional[float] = None,
        snapped_lng: Optional[float] = None,
    ) -> None:
        try:
            key = cls._state_key(vehicle_id)
            mapping = {
                "route_id": route_id or "",
                "direction": direction or "",
                "current_stop_index": str(current_stop_index),
                "current_segment_index": str(current_segment_index),
                "distance_along_route_m": str(round(distance_along_route_m, 1)),
                "last_stop_id": last_stop_id or "",
                "eta_to_next_stop_s": str(round(eta_to_next_stop_s, 1)) if eta_to_next_stop_s is not None else "",
                "snapped_lat": str(round(snapped_lat, 6)) if snapped_lat is not None else "",
                "snapped_lng": str(round(snapped_lng, 6)) if snapped_lng is not None else "",
            }
            client = cls._client()
            client.hset(key, mapping=mapping)
            client.expire(key, cls.VEHICLE_STATE_TTL)
        except Exception as e:
            logger.warning(f"RedisRouteService: failed to set route state for {vehicle_id}: {e}")

    @classmethod
    def get_vehicle_route_state(cls, vehicle_id: str) -> Optional[Dict[str, str]]:
        try:
            raw = cls._client().hgetall(cls._state_key(vehicle_id))
            if not raw:
                return None
            return {cls._decode(k): cls._decode(v) for k, v in raw.items()}
        except Exception as e:
            logger.warning(f"RedisRouteService: failed to get route state for {vehicle_id}: {e}")
            return None

    @classmethod
    def clear_vehicle_route_state(cls, vehicle_id: str) -> None:
        try:
            cls._client().delete(cls._state_key(vehicle_id))
        except Exception as e:
            logger.warning(f"RedisRouteService: failed to clear route state for {vehicle_id}: {e}")

    # ── route vehicles sorted set ────────────────────────────

    ROUTE_VEHICLES_KEY = "vayy:route:vehicles"
    ROUTE_VEHICLES_TTL = 180

    @classmethod
    def _route_vehicles_key(cls, route_id: str) -> str:
        return f"{cls.ROUTE_VEHICLES_KEY}:{route_id}"

    @classmethod
    def add_vehicle_to_route(
        cls,
        route_id: str,
        vehicle_id: str,
        stop_index: int,
        direction: str,
    ) -> None:
        try:
            client = cls._client()
            key = cls._route_vehicles_key(route_id)
            # Score encodes stop_index * 10 + (0 for outbound, 5 for inbound)
            # so same-route same-direction vehicles are grouped.
            direction_offset = 0 if direction == "outbound" else 5
            score = stop_index * 10 + direction_offset
            client.zadd(key, {vehicle_id: score})
            client.expire(key, cls.ROUTE_VEHICLES_TTL)
        except Exception as e:
            logger.warning(f"RedisRouteService: failed to add vehicle {vehicle_id} to route {route_id}: {e}")

    @classmethod
    def remove_vehicle_from_route(cls, route_id: str, vehicle_id: str) -> None:
        try:
            client = cls._client()
            key = cls._route_vehicles_key(route_id)
            client.zrem(key, vehicle_id)
            # If set is empty, remove the key
            if client.zcard(key) == 0:
                client.delete(key)
        except Exception as e:
            logger.warning(f"RedisRouteService: failed to remove vehicle {vehicle_id} from route {route_id}: {e}")

    @classmethod
    def get_vehicles_on_route(
        cls,
        route_id: str,
        direction: Optional[str] = None,
        min_stop_index: Optional[int] = None,
        max_stop_index: Optional[int] = None,
    ) -> List[Dict[str, Any]]:
        """
        Returns vehicles on a route, optionally filtered by direction
        and stop_index range.
        """
        try:
            client = cls._client()
            key = cls._route_vehicles_key(route_id)
            all_members = client.zrange(key, 0, -1, withscores=True)
            if not all_members:
                return []

            results = []
            for member, score in all_members:
                vid = cls._decode(member)
                decoded_score = int(score)
                v_stop_index = decoded_score // 10
                v_direction = "outbound" if (decoded_score % 10) == 0 else "inbound"

                if direction and v_direction != direction:
                    continue
                if min_stop_index is not None and v_stop_index < min_stop_index:
                    continue
                if max_stop_index is not None and v_stop_index > max_stop_index:
                    continue

                state = cls.get_vehicle_route_state(vid)
                results.append({
                    "vehicle_id": vid,
                    "stop_index": v_stop_index,
                    "direction": v_direction,
                    "state": state,
                })

            return results
        except Exception as e:
            logger.warning(f"RedisRouteService: failed to get vehicles on route {route_id}: {e}")
            return []

    # ── per-vehicle ETA cache ────────────────────────────────

    VEHICLE_ETAS_KEY = "vayy:vehicle:etas"
    VEHICLE_ETAS_TTL = 120

    @classmethod
    def _etas_key(cls, vehicle_id: str) -> str:
        return f"{cls.VEHICLE_ETAS_KEY}:{vehicle_id}"

    @classmethod
    def set_vehicle_etas(
        cls,
        vehicle_id: str,
        eta_map: Dict[str, float],
    ) -> None:
        """
        eta_map: { stop_id: eta_seconds }
        """
        try:
            key = cls._etas_key(vehicle_id)
            client = cls._client()
            if not eta_map:
                client.delete(key)
                return
            mapping = {sid: str(round(eta_s, 1)) for sid, eta_s in eta_map.items()}
            client.hset(key, mapping=mapping)
            client.expire(key, cls.VEHICLE_ETAS_TTL)
        except Exception as e:
            logger.warning(f"RedisRouteService: failed to set ETAs for {vehicle_id}: {e}")

    @classmethod
    def get_vehicle_etas(cls, vehicle_id: str) -> Optional[Dict[str, float]]:
        try:
            raw = cls._client().hgetall(cls._etas_key(vehicle_id))
            if not raw:
                return None
            return {cls._decode(k): float(cls._decode(v)) for k, v in raw.items()}
        except Exception as e:
            logger.warning(f"RedisRouteService: failed to get ETAs for {vehicle_id}: {e}")
            return None

    # ── active trips per route ───────────────────────────────

    ROUTE_TRIPS_KEY = "vayy:route:active_trips"
    ROUTE_TRIPS_TTL = 300

    @classmethod
    def _route_trips_key(cls, route_id: str) -> str:
        return f"{cls.ROUTE_TRIPS_KEY}:{route_id}"

    @classmethod
    def add_active_trip(cls, route_id: str, trip_id: str) -> None:
        try:
            key = cls._route_trips_key(route_id)
            client = cls._client()
            client.sadd(key, trip_id)
            client.expire(key, cls.ROUTE_TRIPS_TTL)
        except Exception as e:
            logger.warning(f"RedisRouteService: failed to add trip {trip_id} to route {route_id}: {e}")

    @classmethod
    def remove_active_trip(cls, route_id: str, trip_id: str) -> None:
        try:
            key = cls._route_trips_key(route_id)
            client = cls._client()
            client.srem(key, trip_id)
            if client.scard(key) == 0:
                client.delete(key)
        except Exception as e:
            logger.warning(f"RedisRouteService: failed to remove trip {trip_id} from route {route_id}: {e}")

    @classmethod
    def get_active_trip_ids(cls, route_id: str) -> List[str]:
        try:
            raw = cls._client().smembers(cls._route_trips_key(route_id))
            return [cls._decode(v) for v in raw]
        except Exception as e:
            logger.warning(f"RedisRouteService: failed to get active trips for route {route_id}: {e}")
            return []

    # ── ride requests sorted set ─────────────────────────────

    RIDE_REQUESTS_KEY = "vayy:ride_requests"
    RIDE_REQUESTS_TTL = 600

    @classmethod
    def _ride_requests_key(cls, trip_id: str) -> str:
        return f"{cls.RIDE_REQUESTS_KEY}:{trip_id}"

    @classmethod
    def add_ride_request(
        cls,
        trip_id: str,
        request_id: str,
        created_at_ts: float,
        pickup_stop_id: str,
        dropoff_stop_id: str,
    ) -> None:
        try:
            key = cls._ride_requests_key(trip_id)
            client = cls._client()
            # Store request metadata in a separate hash
            meta_key = f"{key}:{request_id}"
            client.hset(meta_key, mapping={
                "pickup_stop_id": pickup_stop_id,
                "dropoff_stop_id": dropoff_stop_id,
            })
            client.expire(meta_key, cls.RIDE_REQUESTS_TTL)
            client.zadd(key, {request_id: created_at_ts})
            client.expire(key, cls.RIDE_REQUESTS_TTL)
        except Exception as e:
            logger.warning(f"RedisRouteService: failed to add ride request {request_id}: {e}")

    @classmethod
    def get_ride_requests(cls, trip_id: str) -> List[Dict[str, str]]:
        try:
            key = cls._ride_requests_key(trip_id)
            client = cls._client()
            raw = client.zrange(key, 0, -1, withscores=True)
            results = []
            for request_id, score in raw:
                rid = cls._decode(request_id)
                meta_key = f"{key}:{rid}"
                meta = client.hgetall(meta_key)
                meta = {cls._decode(k): cls._decode(v) for k, v in meta.items()}
                results.append({
                    "request_id": rid,
                    "created_at_ts": score,
                    "pickup_stop_id": meta.get("pickup_stop_id", ""),
                    "dropoff_stop_id": meta.get("dropoff_stop_id", ""),
                })
            return results
        except Exception as e:
            logger.warning(f"RedisRouteService: failed to get ride requests for {trip_id}: {e}")
            return []

    @classmethod
    def remove_ride_request(cls, trip_id: str, request_id: str) -> None:
        try:
            key = cls._ride_requests_key(trip_id)
            client = cls._client()
            client.zrem(key, request_id)
            client.delete(f"{key}:{request_id}")
        except Exception as e:
            logger.warning(f"RedisRouteService: failed to remove ride request {request_id}: {e}")
