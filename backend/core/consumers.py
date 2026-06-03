import json
import os
import logging
from channels.generic.websocket import AsyncWebsocketConsumer
from channels.db import database_sync_to_async
from core.utils import get_eta_osrm_async, get_table_eta_async
from core.services.redis_service import get_async_redis_client

logger = logging.getLogger(__name__)


class VayyConsumer(AsyncWebsocketConsumer):
    async def connect(self):
        kwargs = self.scope["url_route"]["kwargs"]
        # Support both city_id (new) and university_id (legacy) in URL kwargs
        self.city_id = kwargs.get("city_id") or kwargs.get("university_id")
        self.role = kwargs.get("role")
        self.trip_id = kwargs.get("trip_id")
        self.redis = get_async_redis_client()

        # Resolve city_id from trip if not in URL
        if not self.city_id and self.trip_id:
            self.city_id = await self._get_city_from_trip(self.trip_id)
            if self.city_id:
                self.city_group_name = f"city_{self.city_id}"
                await self.channel_layer.group_add(
                    self.city_group_name, self.channel_name
                )

        # Join city-level group (all active buses in a city)
        if self.city_id:
            self.city_group_name = f"city_{self.city_id}"
            await self.channel_layer.group_add(self.city_group_name, self.channel_name)
        else:
            # No city — join the global public group
            self.city_group_name = "city_public"
            await self.channel_layer.group_add(self.city_group_name, self.channel_name)

        # Join trip-level group (specific bus tracking)
        if self.trip_id:
            self.trip_group_name = f"trip_{self.trip_id}"
            await self.channel_layer.group_add(self.trip_group_name, self.channel_name)
        else:
            self.trip_group_name = None

        # Join user-specific group for alerts
        user = self.scope["user"]
        if user.is_authenticated:
            self.user_group_name = f"user_{user.id}"
            await self.channel_layer.group_add(self.user_group_name, self.channel_name)

        await self.accept()

    async def disconnect(self, close_code):
        # We no longer broadcast 'vehicle_stopped' here because a simple socket 
        # flicker or page refresh shouldn't end the trip for everyone else.
        # Trip status is managed via API and background cleanup tasks.
        
        await self.channel_layer.group_discard(self.city_group_name, self.channel_name)
        if self.trip_group_name:
            await self.channel_layer.group_discard(
                self.trip_group_name, self.channel_name
            )

        if hasattr(self, "user_group_name"):
            await self.channel_layer.group_discard(
                self.user_group_name, self.channel_name
            )

    async def receive(self, text_data):
        try:
            data = json.loads(text_data)
            t_id = data.get("trip_id") or data.get("tripId") or self.trip_id
            if self.role == "driver" and t_id:
                trip_exists = await self._check_trip_exists(t_id)
                if not trip_exists:
                    await self.send(
                        text_data=json.dumps(
                            {
                                "type": "vehicle_stopped",
                                "trip_id": str(self.trip_id),
                                "reason": "trip_not_found",
                            }
                        )
                    )
                    return
                lat = float(data["lat"])
                lon = float(data["lon"])

                # 1. Use centralized logic for Redis update, delay calculation, and broadcasting
                # Note: process_gps_update handles group_send to trip and city groups
                from core.utils import process_gps_update

                await database_sync_to_async(process_gps_update)(
                    trip_id=t_id, lat=lat, lon=lon, source="websocket"
                )

                # 2. (Optional) Still compute next stop ETAs for trip-specific back-broadcast
                # if the consumer needs to send more detailed info specifically back to the driver
                # but process_gps_update already covers the main passenger/admin needs.

            elif self.role in ("passenger", "student"):
                # Passenger sends their location or signals a hand-raise
                p_lat = float(data.get("lat", 0))
                p_lon = float(data.get("lon", 0))
                user_id = str(self.scope["user"].id)

                if data.get("type") == "toggle_hand_raise":
                    current_status = await self.redis.get(
                        f"passenger_hand_raised:{user_id}"
                    )
                    new_status = b"0" if current_status == b"1" else b"1"
                    await self.redis.set(
                        f"passenger_hand_raised:{user_id}", new_status, ex=300
                    )

                    # Broadcast specifically the hand raise update
                    await self.channel_layer.group_send(
                        self.city_group_name,
                        {
                            "type": "passenger_update",
                            "user_id": user_id,
                            "lat": p_lat,
                            "lon": p_lon,
                            "hand_raised": new_status == b"1",
                        },
                    )
                    return

                # Normal location update
                # Store in Redis for bulk sync
                await self.redis.geoadd("passenger_locations", (p_lon, p_lat, user_id))
                await self.redis.set(f"passenger_last_active:{user_id}", "1", ex=300)

                # Check current hand raise status to include in update
                is_hand_raised = (
                    await self.redis.get(f"passenger_hand_raised:{user_id}")
                ) == b"1"

                # Broadcast to city group so admin/driver can see live positions
                await self.channel_layer.group_send(
                    self.city_group_name,
                    {
                        "type": "passenger_update",
                        "user_id": user_id,
                        "lat": p_lat,
                        "lon": p_lon,
                        "hand_raised": is_hand_raised,
                    },
                )

                # If tracking a specific trip, send back ETA
                if self.trip_id:
                    d_pos = await self.redis.get(f"driver_pos:{self.trip_id}")
                    if d_pos:
                        if isinstance(d_pos, bytes):
                            d_pos = d_pos.decode()
                        d_lon, d_lat = map(float, d_pos.split(","))
                        eta_data = await get_eta_osrm_async(
                            (d_lon, d_lat), (p_lon, p_lat)
                        )

                        response_data = {"type": "eta_update", "data": eta_data}

                        stop_id = data.get("stop_id")
                        if stop_id:
                            stop_pos = await self._get_stop_coords_cached(stop_id)
                            if stop_pos:
                                sp_lon, sp_lat = stop_pos
                                me_to_stop = await get_eta_osrm_async(
                                    (p_lon, p_lat), (sp_lon, sp_lat)
                                )
                                vehicle_to_stop = await get_eta_osrm_async(
                                    (d_lon, d_lat), (sp_lon, sp_lat)
                                )
                                response_data["stop_metrics"] = {
                                    "me_to_stop": me_to_stop,
                                    "vehicle_to_stop": vehicle_to_stop,
                                }
                        await self.send(text_data=json.dumps(response_data))

        except Exception as e:
            logger.error(f"[WS] Error in receive: {e}", exc_info=True)

    # ─── DB & Cache Helpers ───────────────────────────────────────────────────

    async def _get_trip_info_cached(self, trip_id):
        import json as _json

        cache_key = f"trip_info:{trip_id}"
        try:
            raw = await self.redis.get(cache_key)
            if raw:
                return _json.loads(raw)
        except Exception:
            pass

        info = await self._get_trip_info(trip_id)

        try:
            await self.redis.set(cache_key, _json.dumps(info), ex=60)
        except Exception:
            pass

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
                "city_id": str(trip.route.city_id) if trip.route.city_id else None,
                "stop_coords": [
                    (s.location.x, s.location.y, s.name, str(s.id)) for s in stops
                ],
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
            result.append(
                {
                    "stop_id": stop[3],
                    "stop_name": stop[2],
                    "duration_seconds": table_data["durations"][0][i],
                    "distance_meters": table_data["distances"][0][i],
                }
            )
        return result

    @database_sync_to_async
    def _check_trip_exists(self, trip_id):
        from core.models import ActiveTrip

        try:
            return ActiveTrip.objects.filter(id=trip_id, status="active").exists()
        except Exception:
            return False

    @database_sync_to_async
    def _get_stop_coords_cached(self, stop_id):
        from core.models import Stop

        try:
            stop = Stop.objects.get(id=stop_id)
            return (stop.location.x, stop.location.y)
        except Exception:
            return None

    @database_sync_to_async
    def _get_city_from_trip(self, trip_id):
        from core.models import ActiveTrip

        try:
            trip = ActiveTrip.objects.select_related("route__city").get(id=trip_id)
            return str(trip.route.city_id) if trip.route.city_id else None
        except Exception:
            return None

    # ─── Group Message Handlers ───────────────────────────────────────────────

    async def city_vehicle_update(self, event):
        """
        Optimized 'Delta Update' handler. Only sends changed/essential fields
        to reduce outgoing bandwidth.
        """
        # Full object contains: trip_id, lat, lon, bus_number, route_id, next_stop_eta, source, delay_minutes
        # Delta contains: id, lat, lon, h (heading), dc (delay_change)

        delta_payload = {
            "type": "v_delta",  # Shorter type name
            "id": event.get("trip_id"),
            "lat": round(event.get("lat", 0), 6),
            "lon": round(event.get("lon", 0), 6),
            "h": event.get("heading", 0),  # heading
            "d": event.get("delay_minutes", 0),  # current delay
        }

        # Only send bus_number/route_id if it's the first time or every N frames
        # For simplicity in this MVP, we always send ID, lat, lon, h, d.
        # This still removes large strings like 'next_stop_eta' and 'bus_number' from every frame.

        await self.send(text_data=json.dumps(delta_payload))

    async def vehicle_update(self, event):
        """Single trip tracking delta update."""
        delta_payload = {
            "type": "v_delta",
            "id": event.get("trip_id"),
            "lat": round(event.get("lat", 0), 6),
            "lon": round(event.get("lon", 0), 6),
            "h": event.get("heading", 0),
            "d": event.get("delay_minutes", 0),
            "eta": event.get("next_stop_eta", [])[
                :1
            ],  # Only send the very next stop ETA
        }
        await self.send(text_data=json.dumps(delta_payload))

    async def vehicle_stopped(self, event):
        await self.send(text_data=json.dumps(event))

    async def passenger_update(self, event):
        """Handler for passenger location/status updates."""
        await self.send(text_data=json.dumps(event))

    async def trip_started(self, event):
        await self.send(text_data=json.dumps(event))

    async def manifest_update(self, event):
        await self.send(text_data=json.dumps(event))

    async def proximity_alert(self, event):
        await self.send(text_data=json.dumps(event))

    async def stats_update(self, event):
        await self.send(text_data=json.dumps(event))


class DriverConsumer(AsyncWebsocketConsumer):
    """
    Dedicated consumer for Drivers to receive high-priority
    manifest updates and alerts.
    """

    async def connect(self):
        self.vehicle_id = self.scope["url_route"]["kwargs"].get("vehicle_id")
        self.user = self.scope["user"]
        self.redis = get_async_redis_client()

        if not self.user.is_authenticated or self.user.role != "driver":
            await self.close()
            return

        self.manifest_group = f"manifest_{self.vehicle_id}"
        await self.channel_layer.group_add(self.manifest_group, self.channel_name)

        # Also join trip-specific group if they have an active trip
        self.trip_id = await self._get_active_trip_id(self.user.id)
        if self.trip_id:
            await self.channel_layer.group_add(
                f"trip_{self.trip_id}", self.channel_name
            )

        await self.accept()

    async def disconnect(self, close_code):
        await self.channel_layer.group_discard(self.manifest_group, self.channel_name)
        if hasattr(self, "trip_id") and self.trip_id:
            await self.channel_layer.group_discard(
                f"trip_{self.trip_id}", self.channel_name
            )

    @database_sync_to_async
    def _get_active_trip_id(self, user_id):
        from core.models import ActiveTrip

        trip = ActiveTrip.objects.filter(driver_id=user_id, status="active").first()
        return str(trip.id) if trip else None

    async def manifest_update(self, event):
        """
        Receives manifest changes, filters for the next 3 stops based
        on current location, and pushes to the driver.
        """
        import json
        from core.services.manifest import ManifestManager

        trip_id = event.get("trip_id")
        if not trip_id:
            return

        # 1. Fetch current aggregated manifest from Redis
        mm = ManifestManager()
        manifest = mm.get_manifest(trip_id)
        if not manifest:
            await self.send(text_data=json.dumps(event))
            return

        # 2. Filter for "Next 3 Stops"
        # We fetch the driver's progress (order) from Redis
        last_order = 0
        if self.redis:
            last_order_raw = await self.redis.get(f"driver_last_stop:{trip_id}")
            last_order = int(last_order_raw) if last_order_raw else 0
        else:
            # Fallback to sync if async redis not available (unlikely in this env)
            last_order_raw = await database_sync_to_async(mm.redis.get)(
                f"driver_last_stop:{trip_id}"
            )
            last_order = int(last_order_raw) if last_order_raw else 0

        all_stops = manifest.get("stops", [])
        next_3_stops = [s for s in all_stops if s["order"] > last_order][:3]

        # 3. Enrich payload
        enriched_payload = {
            **event,
            "next_3_stops": next_3_stops,
            "total_pending": manifest.get("total_pending", 0),
            "last_updated": manifest.get("last_updated"),
        }

        await self.send(text_data=json.dumps(enriched_payload))
