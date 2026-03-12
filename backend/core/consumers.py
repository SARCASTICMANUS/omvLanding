import json
import redis
import os
from channels.generic.websocket import AsyncWebsocketConsumer
from channels.db import database_sync_to_async
from .utils import get_eta_osrm
from .models import ActiveTrip, Vehicle

REDIS_HOST = "redis" if os.environ.get("IN_DOCKER") else "localhost"
r = redis.Redis(host=REDIS_HOST, port=6379, db=0)


class VayyConsumer(AsyncWebsocketConsumer):
    async def connect(self):
        self.university_id = self.scope["url_route"]["kwargs"].get("university_id")
        self.role = self.scope["url_route"]["kwargs"].get("role")
        self.trip_id = self.scope["url_route"]["kwargs"].get("trip_id")

        # If university_id is missing (legacy route), we might need to fetch it from trip or user
        if not self.university_id and self.trip_id:
            self.university_id = await self.get_university_from_trip(self.trip_id)

        # Build Group Names
        if self.university_id:
            self.univ_group_name = f"university_{self.university_id}"
            await self.channel_layer.group_add(self.univ_group_name, self.channel_name)
        else:
            self.univ_group_name = None  # Ensure it's set even if not joining

        if self.trip_id:
            self.trip_group_name = f"trip_{self.trip_id}"
            await self.channel_layer.group_add(self.trip_group_name, self.channel_name)
        else:
            self.trip_group_name = None  # Ensure it's set even if not joining

        await self.accept()

        # Notify about new student for stats if needed
        if self.role == "student" and self.trip_group_name:
            await self.broadcast_trip_stats()

    @database_sync_to_async
    def get_university_from_trip(self, trip_id):
        from .models import ActiveTrip

        try:
            trip = ActiveTrip.objects.get(id=trip_id)
            return str(trip.route.university.id)
        except Exception:
            return None

    async def broadcast_trip_stats(self):
        """Broadcast passenger count to the trip group (mostly for driver)"""
        # Note: This is a simplification. Usually you'd use a more robust way to count
        # but for now we can trigger a ping or use Redis.
        # Let's just send a type that MapDriver recognizes.
        await self.channel_layer.group_send(
            self.trip_group_name,
            {
                "type": "stats_update",
                "passenger_count": 1,  # Placeholder for real count logic
            },
        )

    async def disconnect(self, close_code):
        if self.role == "driver" and self.trip_id:
            await self.close_trip_in_db(self.trip_id)
            if self.univ_group_name:
                await self.channel_layer.group_send(
                    self.univ_group_name,
                    {"type": "vehicle_stopped", "trip_id": self.trip_id},
                )
            r.delete(f"driver_pos:{self.trip_id}")

        if self.univ_group_name:
            await self.channel_layer.group_discard(
                self.univ_group_name, self.channel_name
            )
        if self.trip_group_name:
            await self.channel_layer.group_discard(
                self.trip_group_name, self.channel_name
            )

    async def receive(self, text_data):
        try:
            data = json.loads(text_data)

            if self.role == "driver" and self.trip_id:
                # 1. Update Ephemeral Position in Redis
                r.geoadd(
                    f"driver_pos:{self.trip_id}", (data["lon"], data["lat"], "vehicle")
                )

                # 2. Broadcast to University Group (Global tracking for students)
                if self.univ_group_name:
                    await self.channel_layer.group_send(
                        self.univ_group_name,
                        {
                            "type": "university_vehicle_update",
                            "trip_id": str(self.trip_id),
                            "lat": float(data["lat"]),
                            "lon": float(data["lon"]),
                            "vehicle_number": data.get("vehicle_number", "Bus"),
                        },
                    )

                # 3. Broadcast to Trip Group (Specifically for ETA to assigned students)
                if self.trip_group_name:
                    await self.channel_layer.group_send(
                        self.trip_group_name,
                        {
                            "type": "vehicle_update",
                            "trip_id": str(self.trip_id),
                            "lat": float(data["lat"]),
                            "lon": float(data["lon"]),
                            "vehicle_number": data.get("vehicle_number", "Bus"),
                        },
                    )

            elif self.role == "student":
                # Only calculate ETA if tracking a specific trip
                if self.trip_id:
                    # Fetch Driver's current position from Redis
                    driver_pos = r.geopos(f"driver_pos:{self.trip_id}", "vehicle")

                    if driver_pos and driver_pos[0]:
                        d_lon, d_lat = driver_pos[0]

                        # Basic ETA from Vehicle to Student
                        response_data = {
                            "type": "eta_update",
                            "data": get_eta_osrm(
                                (d_lon, d_lat), (data["lon"], data["lat"])
                            ),
                        }

                        # If stop_id is provided, calculate specialized distances
                        stop_id = data.get("stop_id")
                        if stop_id:
                            stop_pos = await self.get_stop_coords(stop_id)
                            if stop_pos:
                                s_lon, s_lat = stop_pos
                                # 1. Distance between Student and Stop
                                me_to_stop = get_eta_osrm(
                                    (data["lon"], data["lat"]), (s_lon, s_lat)
                                )
                                # 2. Distance between Vehicle and Stop
                                vehicle_to_stop = get_eta_osrm(
                                    (d_lon, d_lat), (s_lon, s_lat)
                                )

                                response_data["stop_metrics"] = {
                                    "me_to_stop": me_to_stop,
                                    "vehicle_to_stop": vehicle_to_stop,
                                }

                        await self.send(text_data=json.dumps(response_data))

        except Exception as e:
            print(f"WS Error: {e}")

    @database_sync_to_async
    def get_stop_coords(self, stop_id):
        from .models import Stop

        try:
            stop = Stop.objects.get(id=stop_id)
            return (stop.location.x, stop.location.y)
        except Exception:
            return None

    # --- Database Helper Methods (Must be wrapped for Async) ---
    @database_sync_to_async
    def close_trip_in_db(self, trip_id):
        ActiveTrip.objects.filter(id=trip_id).update(is_active=False)

    # --- Handlers ---
    async def university_vehicle_update(self, event):
        # All connected clients in university group receive this
        await self.send(text_data=json.dumps(event))

    async def vehicle_update(self, event):
        # Specific to trip group
        await self.send(text_data=json.dumps(event))

    async def vehicle_stopped(self, event):
        await self.send(text_data=json.dumps(event))

    async def stats_update(self, event):
        await self.send(text_data=json.dumps(event))
