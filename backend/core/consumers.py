# import json
# import redis
# import os
# from channels.generic.websocket import AsyncWebsocketConsumer
# from .utils import get_eta_osrm

# # DYNAMIC REDIS CONNECTION (Fixes the Error 11001)
# # If running in Docker, hostname is 'redis'. If local, it's 'localhost'.
# REDIS_HOST = "redis" if os.environ.get("IN_DOCKER") else "localhost"

# # Create the Redis connection
# try:
#     r = redis.Redis(host=REDIS_HOST, port=6379, db=0)
# except Exception as e:
#     print(f"Redis Connection Error: {e}")


# class VayyConsumer(AsyncWebsocketConsumer):
#     async def connect(self):
#         self.trip_id = self.scope["url_route"]["kwargs"]["trip_id"]
#         self.role = self.scope["url_route"]["kwargs"]["role"]  # 'driver' or 'passenger'
#         self.group_name = f"trip_{self.trip_id}"

#         # Join the trip group
#         await self.channel_layer.group_add(self.group_name, self.channel_name)
#         await self.accept()

#     async def disconnect(self, close_code):
#         if self.role == "passenger":
#             # Remove from active set
#             r.srem(f"passengers:{self.trip_id}", self.channel_name)
#             # Notify driver
#             await self.update_driver_counts()

#         await self.channel_layer.group_discard(self.group_name, self.channel_name)

#     async def receive(self, text_data):
#         try:
#             data = json.loads(text_data)

#             if self.role == "driver":
#                 # 1. Update Driver Location in Redis (Ephemeral)
#                 # Storing as GEO allows us to query distance easily if needed later
#                 r.geoadd(
#                     f"driver_pos:{self.trip_id}", (data["lon"], data["lat"], "vehicle")
#                 )

#                 # 2. Broadcast position to ALL Passengers in this trip
#                 await self.channel_layer.group_send(
#                     self.group_name,
#                     {"type": "vehicle_update", "lat": data["lat"], "lon": data["lon"]},
#                 )

#             elif self.role == "passenger":
#                 # Passenger sends heartbeat/location
#                 # 1. Add to set for counting
#                 r.sadd(f"passengers:{self.trip_id}", self.channel_name)

#                 # 2. Update Driver Dashboard
#                 await self.update_driver_counts()

#                 # 3. Calculate Personalized ETA (From Driver -> This Passenger)
#                 # Get driver's last known position from Redis
#                 driver_pos = r.geopos(f"driver_pos:{self.trip_id}", "vehicle")

#                 if driver_pos and driver_pos[0]:
#                     d_lon, d_lat = driver_pos[0]
#                     # Call OSRM to get real road distance/time
#                     eta = get_eta_osrm((d_lon, d_lat), (data["lon"], data["lat"]))

#                     if eta:
#                         # Send private message ONLY to this passenger
#                         await self.send(
#                             text_data=json.dumps({"type": "eta_update", "data": eta})
#                         )

#         except Exception as e:
#             print(f"WebSocket Error: {e}")

#     async def update_driver_counts(self):
#         # Count how many unique passengers are in the Redis set
#         count = r.scard(f"passengers:{self.trip_id}")

#         # Broadcast to everyone (Frontend driver filters this)
#         await self.channel_layer.group_send(
#             self.group_name, {"type": "stats_update", "passenger_count": count}
#         )

#     # --- Handlers for Group Messages ---
#     async def vehicle_update(self, event):
#         # Send to passengers
#         if self.role == "passenger":
#             await self.send(text_data=json.dumps(event))

#     async def stats_update(self, event):
#         # Send to driver
#         if self.role == "driver":
#             await self.send(text_data=json.dumps(event))
import json
import redis
import os
from channels.generic.websocket import AsyncWebsocketConsumer
from channels.db import database_sync_to_async
from .utils import get_eta_osrm
from .models import ActiveTrip  # Import your model

REDIS_HOST = "redis" if os.environ.get("IN_DOCKER") else "localhost"
r = redis.Redis(host=REDIS_HOST, port=6379, db=0)


class VayyConsumer(AsyncWebsocketConsumer):
    async def connect(self):
        self.trip_id = self.scope["url_route"]["kwargs"]["trip_id"]
        self.role = self.scope["url_route"]["kwargs"]["role"]
        self.group_name = f"trip_{self.trip_id}"

        await self.channel_layer.group_add(self.group_name, self.channel_name)
        await self.accept()

    async def disconnect(self, close_code):
        # EDGE CASE: Driver Disconnects (Close Tab / Loss of Signal)
        if self.role == "driver":
            # 1. Mark Trip as Inactive in DB
            await self.close_trip_in_db(self.trip_id)

            # 2. Notify all Passengers that trip is over
            await self.channel_layer.group_send(
                self.group_name,
                {"type": "trip_ended_event", "message": "Driver has ended the trip."},
            )

            # 3. Clean up Redis (Optional but good practice)
            r.delete(f"driver_pos:{self.trip_id}")

        elif self.role == "passenger":
            r.srem(f"passengers:{self.trip_id}", self.channel_name)
            await self.update_driver_counts()

        await self.channel_layer.group_discard(self.group_name, self.channel_name)

    async def receive(self, text_data):
        try:
            data = json.loads(text_data)

            if self.role == "driver":
                # Update Redis
                r.geoadd(
                    f"driver_pos:{self.trip_id}", (data["lon"], data["lat"], "vehicle")
                )

                # Broadcast to passengers
                await self.channel_layer.group_send(
                    self.group_name,
                    {"type": "vehicle_update", "lat": data["lat"], "lon": data["lon"]},
                )

            elif self.role == "passenger":
                # Heartbeat from passenger
                print("passenger heartbeat")
                r.sadd(f"passengers:{self.trip_id}", self.channel_name)
                await self.update_driver_counts()

                # Calculate ETA
                driver_pos = r.geopos(f"driver_pos:{self.trip_id}", "vehicle")
                print("driver_pos", driver_pos)
                if driver_pos and driver_pos[0]:
                    d_lon, d_lat = driver_pos[0]
                    eta = get_eta_osrm((d_lon, d_lat), (data["lon"], data["lat"]))
                    if eta:
                        await self.send(
                            text_data=json.dumps({"type": "eta_update", "data": eta})
                        )
        except Exception as e:
            print(f"WS Error: {e}")

    async def update_driver_counts(self):
        count = r.scard(f"passengers:{self.trip_id}")
        await self.channel_layer.group_send(
            self.group_name, {"type": "stats_update", "passenger_count": count}
        )

    # --- Database Helper Methods (Must be wrapped for Async) ---
    @database_sync_to_async
    def close_trip_in_db(self, trip_id):
        try:
            ActiveTrip.objects.filter(id=trip_id).update(is_active=False)
            print(f"Trip {trip_id} marked inactive.")
        except Exception as e:
            print(f"DB Error closing trip: {e}")

    # --- Handlers ---
    async def vehicle_update(self, event):
        if self.role == "passenger":
            await self.send(text_data=json.dumps(event))

    async def stats_update(self, event):
        if self.role == "driver":
            await self.send(text_data=json.dumps(event))

    async def trip_ended_event(self, event):
        # Tell everyone the party is over
        await self.send(
            text_data=json.dumps({"type": "trip_ended", "message": event["message"]})
        )
