import json
import logging
from typing import Dict, List, Optional

from django.core.cache import cache

logger = logging.getLogger(__name__)

# Redis key names
GEO_KEY = "vayy:vehicles:locations"
META_PREFIX = "vayy:vehicles:meta"


class RedisGeoService:
    """
    Redis GEO-based service for real-time nearby vehicle lookups.
    Uses Redis GEOADD / GEORADIUS for spatial queries and
    HASH keys for vehicle metadata.
    """

    @staticmethod
    def _decode(val):
        """Decode bytes to str if needed."""
        return val.decode() if isinstance(val, bytes) else val

    @staticmethod
    def _meta_key(vehicle_id: str) -> str:
        return f"{META_PREFIX}:{vehicle_id}"

    @classmethod
    def add_vehicle(
        cls,
        vehicle_id: str,
        lat: float,
        lng: float,
        vehicle_type: str,
        driver_id: Optional[str] = None,
        vehicle_number: Optional[str] = None,
        trip_id: Optional[str] = None,
    ) -> None:
        """
        Add or update a vehicle's location in the Redis GEO set
        and store its metadata in a hash.
        """
        try:
            client = cache.client.get_client()

            # GEOADD updates the score (location) if member already exists
            client.geoadd(GEO_KEY, (lng, lat, vehicle_id))

            # Store metadata as a hash for post-filtering and response building
            meta = {
                "vehicle_type": vehicle_type or "",
                "driver_id": driver_id or "",
                "vehicle_number": vehicle_number or "",
                "trip_id": trip_id or "",
            }
            meta_key = cls._meta_key(vehicle_id)
            client.hset(meta_key, mapping=meta)
            client.expire(meta_key, 120)

            logger.debug(f"Redis GEO: added vehicle {vehicle_id} at ({lat}, {lng})")
        except Exception as e:
            logger.warning(f"Redis GEO: failed to add vehicle {vehicle_id}: {e}")

    @classmethod
    def remove_vehicle(cls, vehicle_id: str) -> None:
        """
        Remove a vehicle from the Redis GEO set and its metadata hash.
        """
        try:
            client = cache.client.get_client()
            client.zrem(GEO_KEY, vehicle_id)
            client.delete(cls._meta_key(vehicle_id))
            logger.debug(f"Redis GEO: removed vehicle {vehicle_id}")
        except Exception as e:
            logger.warning(f"Redis GEO: failed to remove vehicle {vehicle_id}: {e}")

    @classmethod
    def get_nearby(
        cls,
        lat: float,
        lng: float,
        radius_m: int = 5000,
        vehicle_type: Optional[str] = None,
    ) -> List[Dict]:
        """
        Find vehicles within radius_m meters of (lat, lng).
        Optionally filter by vehicle_type.
        Returns a list of dicts with vehicle info + distance.
        """
        try:
            client = cache.client.get_client()

            # GEORADIUS with DISTANCE, ASC order, no count limit
            raw = client.georadius(
                GEO_KEY,
                longitude=lng,
                latitude=lat,
                radius=radius_m,
                unit="m",
                withdist=True,
                withcoord=True,
                sort="ASC",
            )

            if not raw:
                return []

            # Fetch metadata hashes in a single pipeline (avoids N round-trips)
            with client.pipeline(transaction=False) as pipe:
                for item in raw:
                    pipe.hgetall(cls._meta_key(cls._decode(item[0])))
                meta_list = pipe.execute()

            results = []
            for (item, meta) in zip(raw, meta_list):
                member = cls._decode(item[0])
                distance = item[1]
                coord = item[2]  # [lng, lat]

                if not meta:
                    continue

                # Decode all meta values from bytes to str
                meta = {cls._decode(k): cls._decode(v) for k, v in meta.items()}

                v_type = meta.get("vehicle_type", "")

                # Post-filter by vehicle_type
                if vehicle_type and v_type != vehicle_type:
                    continue

                results.append({
                    "vehicle_id": member,
                    "vehicle_type": v_type,
                    "driver_id": meta.get("driver_id", ""),
                    "vehicle_number": meta.get("vehicle_number", ""),
                    "trip_id": meta.get("trip_id", ""),
                    "lat": coord[1],
                    "lng": coord[0],
                    "distance_m": round(distance, 1),
                })

            return results

        except Exception as e:
            logger.warning(f"Redis GEO: nearby search failed: {e}")
            return []

    @classmethod
    def get_vehicle_location(cls, vehicle_id: str) -> Optional[Dict]:
        """
        Get a single vehicle's location and metadata from Redis.
        """
        try:
            client = cache.client.get_client()

            pos = client.geopos(GEO_KEY, vehicle_id)
            if not pos or pos[0] is None:
                return None

            lng, lat = pos[0]
            meta = client.hgetall(cls._meta_key(vehicle_id))
            meta = {cls._decode(k): cls._decode(v) for k, v in meta.items()}

            return {
                "vehicle_id": vehicle_id,
                "lat": lat,
                "lng": lng,
                "vehicle_type": meta.get("vehicle_type", ""),
                "driver_id": meta.get("driver_id", ""),
                "vehicle_number": meta.get("vehicle_number", ""),
                "trip_id": meta.get("trip_id", ""),
            }

        except Exception as e:
            logger.warning(f"Redis GEO: get vehicle location failed: {e}")
            return None
