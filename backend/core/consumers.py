import json
import os
import logging
from channels.generic.websocket import AsyncWebsocketConsumer
from channels.db import database_sync_to_async
from core.utils import get_eta_osrm_async, get_table_eta_async

logger = logging.getLogger(__name__)

REDIS_HOST = "redis" if os.environ.get("IN_DOCKER") else "localhost"

# Use redis.asyncio
try:
    from redis.asyncio import Redis as AsyncRedis
    _async_redis_available = True
except ImportError:
    import redis as _redis_sync
    _async_redis_available = False


def _get_redis():
    if _async_redis_available:
        return AsyncRedis(host=REDIS_HOST, port=6379, db=0)
    return None # Fallback not implemented for simplicity; async redis required for scale


class VayyConsumer(AsyncWebsocketConsumer):
    async def connect(self):
        self.university_id = self.scope["url_route"]["kwargs"].get("university_id")
        self.role = self.scope["url_route"]["kwargs"].get("role")
        self.trip_id = self.scope["url_route"]["kwargs"].get("trip_id")
        self.redis = _get_redis()

        # Resolve university_id from trip if not in URL
        if not self.university_id and self.trip_id:
            self.university_id = await self._get_university_from_trip(self.trip_id)

        # Join groups
        if self.university_id:
            self.univ_group_name = f"university_{self.university_id}"
            await self.channel_layer.group_add(self.univ_group_name, self.channel_name)
        else:
            self.univ_group_name = None

        if self.trip_id:
            self.trip_group_name = f"trip_{self.trip_id}"
            await self.channel_layer.group_add(self.trip_group_name, self.channel_name)
        else:
            self.trip_group_name = None

        await self.accept()

    async def disconnect(self, close_code):
        if self.role == "driver" and self.trip_id:
            # We don't deactivate trip immediately in DB for scalability (wait for stale timeout)
            # but we broadcast a stop event.
            if self.univ_group_name:
                await self.channel_layer.group_send(
                    self.univ_group_name,
                    {"type": "vehicle_stopped", "trip_id": str(self.trip_id)},
                )
            # Clear Redis position
            try:
                await self.redis.delete(f"driver_pos:{self.trip_id}")
            except Exception:
                pass

        if self.univ_group_name:
            await self.channel_layer.group_discard(self.univ_group_name, self.channel_name)
        if self.trip_group_name:
            await self.channel_layer.group_discard(self.trip_group_name, self.channel_name)
        
        if self.redis:
            await self.redis.aclose()

    async def receive(self, text_data):
        try:
            data = json.loads(text_data)

            if self.role == "driver" and self.trip_id:
                lat = float(data["lat"])
                lon = float(data["lon"])

                # 1. Store position in Redis (Ephemeral)
                # We use a special key for bulk sync to DB later
                await self.redis.geoadd("active_trips_locations", (lon, lat, str(self.trip_id)))
                # Store for quick lookup
                await self.redis.set(f"driver_pos:{self.trip_id}", f"{lon},{lat}", ex=30)

                # 2. Fetch route info (Cached in instance or Redis)
                trip_info = await self._get_trip_info_cached(self.trip_id)
                bus_number = trip_info.get("bus_number", "Bus")
                route_id = trip_info.get("route_id")
                
                # 3. Compute next stop ETAs using Table API (Efficient)
                next_stop_eta = await self._compute_next_stop_eta_async(trip_info, lat, lon)

                # 4. Broadcast to groups
                payload = {
                    "trip_id": str(self.trip_id),
                    "lat": lat,
                    "lon": lon,
                    "bus_number": bus_number,
                    "route_id": route_id,
                    "next_stop_eta": next_stop_eta,
                }

                if self.univ_group_name:
                    await self.channel_layer.group_send(
                        self.univ_group_name,
                        {**payload, "type": "university_vehicle_update"},
                    )

                if self.trip_group_name:
                    await self.channel_layer.group_send(
                        self.trip_group_name,
                        {**payload, "type": "vehicle_update"},
                    )

            elif self.role == "student":
                s_lat = float(data.get("lat", 0))
                s_lon = float(data.get("lon", 0))
                
                # 1. Update Student Profile in Redis for bulk sync
                await self.redis.geoadd("student_locations", (s_lon, s_lat, str(self.scope["user"].id)))
                await self.redis.set(f"student_last_active:{self.scope['user'].id}", "1", ex=300)

                # 2. Broadcast to University Group
                if self.univ_group_name:
                    await self.channel_layer.group_send(
                        self.univ_group_name,
                        {
                            "type": "student_update",
                            "user_id": str(self.scope["user"].id),
                            "lat": s_lat,
                            "lon": s_lon,
                        },
                    )

                # 3. If tracking a specific trip, send back ETA
                if self.trip_id:
                    d_pos = await self.redis.get(f"driver_pos:{self.trip_id}")
                    if d_pos:
                        d_lon, d_lat = map(float, d_pos.decode().split(","))
                        eta_data = await get_eta_osrm_async((d_lon, d_lat), (s_lon, s_lat))
                        
                        response_data = {"type": "eta_update", "data": eta_data}

                        stop_id = data.get("stop_id")
                        if stop_id:
                            stop_pos = await self._get_stop_coords_cached(stop_id)
                            if stop_pos:
                                sp_lon, sp_lat = stop_pos
                                # Use Table API for multiple points if needed, 
                                # but for student UI, 2 calls are fine if async
                                me_to_stop = await get_eta_osrm_async((s_lon, s_lat), (sp_lon, sp_lat))
                                vehicle_to_stop = await get_eta_osrm_async((d_lon, d_lat), (sp_lon, sp_lat))
                                response_data["stop_metrics"] = {
                                    "me_to_stop": me_to_stop,
                                    "vehicle_to_stop": vehicle_to_stop,
                                }
                        await self.send(text_data=json.dumps(response_data))

        except Exception as e:
            logger.error(f"[WS] Error in receive: {e}", exc_info=True)

    # ─── DB & Cache Helpers ───────────────────────────────────────────────────

    async def _get_trip_info_cached(self, trip_id):
        """
        Cache trip metadata in Redis for 60 s so we don't hit the DB
        on every WebSocket location message (which can be ~1 Hz per driver).
        """
        import json as _json
        cache_key = f"trip_info:{trip_id}"
        try:
            raw = await self.redis.get(cache_key)
            if raw:
                return _json.loads(raw)
        except Exception:
            pass  # Redis miss — fall through to DB

        info = await self._get_trip_info(trip_id)

        try:
            await self.redis.set(cache_key, _json.dumps(info), ex=60)
        except Exception:
            pass  # Non-critical; trip continues without cached metadata

        return info

    @database_sync_to_async
    def _get_trip_info(self, trip_id):
        from core.models import ActiveTrip
        try:
            trip = ActiveTrip.objects.select_related("route").get(id=trip_id)
            stops = list(trip.route.stops.order_by("order")[:3])
            return {
                "bus_number": trip.route.bus_number,
                "route_id": str(trip.route_id),
                "university_id": str(trip.route.university_id),
                "stop_coords": [(s.location.x, s.location.y, s.name, str(s.id)) for s in stops]
            }
        except Exception:
            return {}

    async def _compute_next_stop_eta_async(self, trip_info, lat, lon):
        stop_coords = trip_info.get("stop_coords", [])
        if not stop_coords:
            return []
        
        sources = [(lon, lat)]
        destinations = [(s[0], s[1]) for s in stop_coords]
        
        table_data = await get_table_eta_async(sources, destinations)
        if not table_data:
            return []
        
        result = []
        for i, stop in enumerate(stop_coords):
            result.append({
                "stop_id": stop[3],
                "stop_name": stop[2],
                "duration_seconds": table_data["durations"][0][i],
                "distance_meters": table_data["distances"][0][i],
            })
        return result

    @database_sync_to_async
    def _get_stop_coords_cached(self, stop_id):
        from core.models import Stop
        try:
            stop = Stop.objects.get(id=stop_id)
            return (stop.location.x, stop.location.y)
        except Exception:
            return None

    @database_sync_to_async
    def _get_university_from_trip(self, trip_id):
        from core.models import ActiveTrip
        try:
            trip = ActiveTrip.objects.select_related("route__university").get(id=trip_id)
            return str(trip.route.university.id)
        except Exception:
            return None

    # ─── Group Message Handlers (Unchanged) ───────────────────────────────────

    async def university_vehicle_update(self, event):
        await self.send(text_data=json.dumps(event))

    async def student_update(self, event):
        await self.send(text_data=json.dumps(event))

    async def vehicle_update(self, event):
        await self.send(text_data=json.dumps(event))

    async def vehicle_stopped(self, event):
        await self.send(text_data=json.dumps(event))

    async def stats_update(self, event):
        await self.send(text_data=json.dumps(event))
