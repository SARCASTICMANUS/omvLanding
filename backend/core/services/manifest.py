import json
from core.services.redis_service import get_redis_client
from django.utils import timezone
from core.models import BoardingRequest, Stop

class ManifestManager:
    def __init__(self):
        self.redis = get_redis_client()

    def recalculate_manifest(self, trip_id):
        """
        Aggregates boarding requests by stop and updates the Redis-based manifest.
        """
        # 1. Fetch pending/approaching requests for this trip
        requests = BoardingRequest.objects.filter(
            trip_id=trip_id,
            status__in=["pending", "approaching"]
        ).select_related("pickup_stop")

        # 1.5 Fetch visited stops from Redis
        visited_stops = self.redis.smembers(f"visited_stops:{trip_id}")
        visited_ids = {v for v in visited_stops}

        # 2. Group by stop
        stop_map = {}
        for req in requests:
            stop_id = str(req.pickup_stop_id)
            if stop_id not in stop_map:
                stop_map[stop_id] = {
                    "stop_id": stop_id,
                    "stop_name": req.pickup_stop.name,
                    "passenger_count": 0,
                    "order": req.pickup_stop.order,
                    "visited": stop_id in visited_ids
                }
            stop_map[stop_id]["passenger_count"] += 1

        # 3. Sort by stop order
        sorted_stops = sorted(stop_map.values(), key=lambda x: x["order"])

        # 4. Update Redis Hash
        hash_key = f"manifest:{trip_id}"
        manifest_payload = {
            "stops_json": json.dumps(sorted_stops),
            "total_pending": requests.count(),
            "last_updated": timezone.now().isoformat()
        }
        
        self.redis.hset(hash_key, mapping=manifest_payload)
        self.redis.expire(hash_key, 3600 * 4) # 4 hour expiry

        return sorted_stops

    def get_manifest(self, trip_id):
        """Retrieves the current manifest from Redis."""
        data = self.redis.hgetall(f"manifest:{trip_id}")
        if not data:
            return None
        
        return {
            "stops": json.loads(data.get("stops_json", "[]")),
            "total_pending": int(data.get("total_pending", 0)),
            "last_updated": data.get("last_updated", "")
        }
