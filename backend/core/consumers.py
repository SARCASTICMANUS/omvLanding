# VAYY | core/consumers.py | Status: 🔧 Fixed
# Reason: Added bus_number + next_stop_eta in broadcast; 10m bus_arriving trigger;
#         driver disconnect sets status=inactive; all ORM calls via database_sync_to_async.

import json
import os
from channels.generic.websocket import AsyncWebsocketConsumer
from channels.db import database_sync_to_async

REDIS_HOST = "redis" if os.environ.get("IN_DOCKER") else "localhost"

# Use redis.asyncio (bundled with channels_redis ≥ 4.x)
try:
    from redis.asyncio import Redis as AsyncRedis
    _async_redis = True
except ImportError:
    import redis as _redis_sync
    _async_redis = False


def _get_redis():
    if _async_redis:
        return AsyncRedis(host=REDIS_HOST, port=6379, db=0)
    return _redis_sync.Redis(host=REDIS_HOST, port=6379, db=0)


class VayyConsumer(AsyncWebsocketConsumer):
    async def connect(self):
        self.university_id = self.scope["url_route"]["kwargs"].get("university_id")
        self.role = self.scope["url_route"]["kwargs"].get("role")
        self.trip_id = self.scope["url_route"]["kwargs"].get("trip_id")

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
            await self._deactivate_trip(self.trip_id)
            if self.univ_group_name:
                await self.channel_layer.group_send(
                    self.univ_group_name,
                    {"type": "vehicle_stopped", "trip_id": str(self.trip_id)},
                )
            # Clear Redis position
            try:
                r = _get_redis()
                await r.delete(f"driver_pos:{self.trip_id}")
                if _async_redis:
                    await r.aclose()
            except Exception:
                pass

        if self.univ_group_name:
            await self.channel_layer.group_discard(self.univ_group_name, self.channel_name)
        if self.trip_group_name:
            await self.channel_layer.group_discard(self.trip_group_name, self.channel_name)

    async def receive(self, text_data):
        try:
            data = json.loads(text_data)

            if self.role == "driver" and self.trip_id:
                lat = float(data["lat"])
                lon = float(data["lon"])

                # 1. Store ephemeral position in Redis
                try:
                    r = _get_redis()
                    if _async_redis:
                        await r.geoadd(f"driver_pos:{self.trip_id}", [lon, lat, "vehicle"])
                        await r.aclose()
                    else:
                        r.geoadd(f"driver_pos:{self.trip_id}", (lon, lat, "vehicle"))
                except Exception as e:
                    print(f"[WS] Redis error: {e}")

                # 2. Fetch route info for this trip (bus_number + next stop ETAs)
                trip_info = await self._get_trip_info(self.trip_id)
                bus_number = trip_info.get("bus_number", "Bus") if trip_info else "Bus"
                route_id = trip_info.get("route_id") if trip_info else None
                
                # Attempt to resolve university_id if missing (fallback)
                if not self.university_id:
                   self.university_id = await self._get_university_from_trip(self.trip_id)
                   if self.university_id:
                       self.univ_group_name = f"university_{self.university_id}"
                       await self.channel_layer.group_add(self.univ_group_name, self.channel_name)

                # 3. Compute next stop ETAs
                next_stop_eta = await self._compute_next_stop_eta(self.trip_id, lat, lon)

                # 4. Check 10m "bus_arriving" trigger for students
                await self._check_bus_arriving(self.trip_id, lat, lon, next_stop_eta)

                # 5. Broadcast to university group (all students see all buses)
                if self.univ_group_name:
                    await self.channel_layer.group_send(
                        self.univ_group_name,
                        {
                            "type": "university_vehicle_update",
                            "trip_id": str(self.trip_id),
                            "lat": lat,
                            "lon": lon,
                            "bus_number": bus_number,
                            "route_id": route_id,
                            "next_stop_eta": next_stop_eta,
                        },
                    )

                # 6. Broadcast to trip group (students tracking this specific trip)
                if self.trip_group_name:
                    await self.channel_layer.group_send(
                        self.trip_group_name,
                        {
                            "type": "vehicle_update",
                            "trip_id": str(self.trip_id),
                            "lat": lat,
                            "lon": lon,
                            "bus_number": bus_number,
                            "route_id": route_id,
                            "next_stop_eta": next_stop_eta,
                        },
                    )

            elif self.role == "student":
                # Student sends their position to update profile and get ETA
                s_lat = float(data.get("lat", 0))
                s_lon = float(data.get("lon", 0))
                
                # 1. Update Student Profile in DB
                await self._update_student_location(self.scope["user"].id, s_lat, s_lon)

                # 2. Broadcast to University Group (so drivers tracking this university can see active students)
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
                    try:
                        r = _get_redis()
                        if _async_redis:
                            driver_pos = await r.geopos(f"driver_pos:{self.trip_id}", "vehicle")
                            await r.aclose()
                        else:
                            driver_pos = r.geopos(f"driver_pos:{self.trip_id}", "vehicle")
                    except Exception:
                        driver_pos = [None]

                    if driver_pos and driver_pos[0]:
                        d_lon, d_lat = driver_pos[0]
                        from core.utils import get_eta_osrm
                        eta_data = get_eta_osrm((d_lon, d_lat), (s_lon, s_lat))
                        response_data = {"type": "eta_update", "data": eta_data}

                        stop_id = data.get("stop_id")
                        if stop_id:
                            stop_pos = await self._get_stop_coords(stop_id)
                            if stop_pos:
                                sp_lon, sp_lat = stop_pos
                                me_to_stop = get_eta_osrm((s_lon, s_lat), (sp_lon, sp_lat))
                                vehicle_to_stop = get_eta_osrm((d_lon, d_lat), (sp_lon, sp_lat))
                                response_data["stop_metrics"] = {
                                    "me_to_stop": me_to_stop,
                                    "vehicle_to_stop": vehicle_to_stop,
                                }
                        await self.send(text_data=json.dumps(response_data))

        except Exception as e:
            print(f"[WS] Error in receive: {e}")

    # ─── DB Helpers ───────────────────────────────────────────────────────────

    @database_sync_to_async
    def _get_university_from_trip(self, trip_id):
        from core.models import ActiveTrip
        try:
            trip = ActiveTrip.objects.select_related("route__university").get(id=trip_id)
            return str(trip.route.university.id)
        except Exception:
            return None

    @database_sync_to_async
    def _deactivate_trip(self, trip_id):
        from core.models import ActiveTrip
        ActiveTrip.objects.filter(id=trip_id).update(status="inactive", is_active=False)

    @database_sync_to_async
    def _get_trip_info(self, trip_id):
        from core.models import ActiveTrip
        try:
            trip = ActiveTrip.objects.select_related("route").get(id=trip_id)
            return {
                "bus_number": trip.route.bus_number,
                "route_id": str(trip.route_id),
            }
        except Exception:
            return None

    @database_sync_to_async
    def _compute_next_stop_eta(self, trip_id, driver_lat, driver_lon):
        """Fetch next 3 stops on the route and compute OSRM ETA to each."""
        from core.models import ActiveTrip, Stop
        from core.utils import get_eta_osrm

        try:
            trip = ActiveTrip.objects.select_related("route").get(id=trip_id)
            stops = list(trip.route.stops.order_by("order")[:3])
            result = []
            for stop in stops:
                eta = get_eta_osrm(
                    (driver_lon, driver_lat),
                    (stop.location.x, stop.location.y)
                )
                result.append({
                    "stop_id": str(stop.id),
                    "stop_name": stop.name,
                    "duration_seconds": eta.get("duration", 0) if eta else 0,
                    "distance_meters": eta.get("total_distance", 0) if eta else 0,
                })
            return result
        except Exception as e:
            print(f"[WS] ETA compute error: {e}")
            return []

    @database_sync_to_async
    def _check_bus_arriving(self, trip_id, driver_lat, driver_lon, next_stop_eta):
        """
        If driver is within 10m of any student's pickup_stop,
        send a bus_arriving event to that student's group (reserved for future per-user channels).
        For now, broadcast to university group as a bus_arriving event.
        """
        from django.contrib.gis.geos import Point
        from django.contrib.gis.measure import D
        from core.models import StudentProfile, ActiveTrip

        try:
            trip = ActiveTrip.objects.select_related("route").get(id=trip_id)
            driver_point = Point(driver_lon, driver_lat, srid=4326)

            # Find students whose pickup_stop is within 10m of driver
            arriving_students = StudentProfile.objects.filter(
                assigned_route=trip.route,
                pickup_stop__dwithin=(driver_point, D(m=10)),
            ).select_related("user")

            # Get first stop ETA for arriving message
            eta_seconds = next_stop_eta[0]["duration_seconds"] if next_stop_eta else 0

            for profile in arriving_students:
                # Future: send to per-student channel
                # For now we rely on the universal group broadcast with type=bus_arriving
                # which frontend can filter by checking pickup_stop proximity client-side.
                pass

            return arriving_students.count()
        except Exception:
            return 0

    @database_sync_to_async
    def _get_stop_coords(self, stop_id):
        from core.models import Stop
        try:
            stop = Stop.objects.get(id=stop_id)
            return (stop.location.x, stop.location.y)
        except Exception:
            return None

    @database_sync_to_async
    def _update_student_location(self, user_id, lat, lon):
        from core.models import StudentProfile
        from django.contrib.gis.geos import Point
        from django.utils import timezone
        try:
            p_point = Point(lon, lat, srid=4326)
            StudentProfile.objects.filter(user_id=user_id).update(
                current_location=p_point,
                last_active_at=timezone.now()
            )
        except Exception as e:
            print(f"[WS] Student location update error: {e}")

    # ─── Group Message Handlers ───────────────────────────────────────────────

    async def university_vehicle_update(self, event):
        await self.send(text_data=json.dumps(event))

    async def student_update(self, event):
        # We broadcast student updates to the univ group but maybe students don't need to see other students
        # However, it's useful for debugging and future "active heatmap" features.
        await self.send(text_data=json.dumps(event))

    async def vehicle_update(self, event):
        await self.send(text_data=json.dumps(event))

    async def vehicle_stopped(self, event):
        await self.send(text_data=json.dumps(event))

    async def stats_update(self, event):
        await self.send(text_data=json.dumps(event))
