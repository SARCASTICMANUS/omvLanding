import json
import logging
from asgiref.sync import sync_to_async
from common.websockets.auth import BaseAuthenticatedConsumer
from tracking.services.location_service import LocationService
from tracking.tasks import process_location_update

logger = logging.getLogger(__name__)

class VehicleTrackingConsumer(BaseAuthenticatedConsumer):
    """
    Consumer for live vehicle tracking.
    Groups: vehicle_{vehicle_id}

    Hot path is fully async: Redis pipeline + Channel layer broadcast.
    Zero DB queries, zero blocking calls. Cold path is fire-and-forget Celery.
    """
    async def connect(self):
        await super().connect()
        self.vehicle_id = self.scope['url_route']['kwargs']['vehicle_id']
        self.group_name = f"vehicle_{self.vehicle_id}"

        await self.channel_layer.group_add(
            self.group_name,
            self.channel_name
        )
        logger.info(f"WebSocket connected to {self.group_name}")

    async def disconnect(self, close_code):
        if not hasattr(self, 'group_name'):
            return
        await self.channel_layer.group_discard(
            self.group_name,
            self.channel_name
        )
        logger.info(f"WebSocket disconnected from {self.group_name}")

    async def receive(self, text_data):
        """
        Handle incoming messages from the driver (e.g., location updates).
        Hot path: fully async Redis + broadcast, zero DB, zero sync_to_async.
        Cold path: fire-and-forget Celery dispatch.
        """
        try:
            data = json.loads(text_data)
            msg_type = data.get("type")
            if msg_type == "location_update":
                payload = {
                    "vehicle_id": str(self.vehicle_id),
                    "trip_id": data.get("trip_id"),
                    "lat": data.get("lat"),
                    "lng": data.get("lon") or data.get("lng"),
                    "speed": data.get("speed", 0),
                    "heading": data.get("heading", 0),
                    # Vehicle metadata from driver app (avoids DB lookup)
                    "vehicle_type": data.get("vehicle_type", ""),
                    "driver_id": data.get("driver_id", ""),
                    "vehicle_number": data.get("vehicle_number", ""),
                }
                # HOT PATH — fully async, zero blocking calls
                await LocationService.hot_path_process_async(
                    payload, self.channel_layer
                )
                # COLD PATH — fire-and-forget Celery, non-blocking
                if LocationService.should_enqueue_cold_path(str(self.vehicle_id)):
                    process_location_update.delay(payload)
                logger.debug(f"Hot+throttled cold path for vehicle {self.vehicle_id}")
            else:
                logger.debug(f"Unknown message type from driver: {msg_type}")
        except json.JSONDecodeError:
            logger.warning("Invalid JSON from driver WebSocket")
        except Exception as e:
            logger.exception(f"Error handling driver WS message: {e}")

    async def vehicle_update(self, event):
        await self.send(text_data=json.dumps(event["data"]))


class TripTrackingConsumer(BaseAuthenticatedConsumer):
    """
    Consumer for live trip tracking.
    Groups: trip_{trip_id}
    """
    async def connect(self):
        await super().connect()
        self.trip_id = self.scope['url_route']['kwargs']['trip_id']
        self.group_name = f"trip_{self.trip_id}"

        await self.channel_layer.group_add(
            self.group_name,
            self.channel_name
        )
        logger.info(f"WebSocket connected to {self.group_name}")

        # Send the last-known vehicle position immediately so the passenger
        # sees the marker without waiting for the next GPS ping.
        snapshot = await LocationService.get_trip_latest_snapshot_async(
            self.trip_id
        )
        if snapshot:
            await self.send(text_data=json.dumps(snapshot))

    async def disconnect(self, close_code):
        if not hasattr(self, 'group_name'):
            return
        await self.channel_layer.group_discard(
            self.group_name,
            self.channel_name
        )
        logger.info(f"WebSocket disconnected from {self.group_name}")

    async def trip_update(self, event):
        await self.send(text_data=json.dumps(event["data"]))


class RouteTrackingConsumer(BaseAuthenticatedConsumer):
    """
    Consumer for real-time vehicle updates on an entire route.
    Groups: route_{route_id}
    """
    async def connect(self):
        await super().connect()
        self.route_id = str(self.scope['url_route']['kwargs']['route_id'])
        self.group_name = f"route_{self.route_id}"

        await self.channel_layer.group_add(
            self.group_name,
            self.channel_name
        )
        logger.info(f"WebSocket connected to route tracking: {self.group_name}")

    async def disconnect(self, close_code):
        if not hasattr(self, 'group_name'):
            return
        await self.channel_layer.group_discard(
            self.group_name,
            self.channel_name
        )
        logger.info(f"WebSocket disconnected from route tracking: {self.group_name}")

    async def route_vehicle_update(self, event):
        await self.send(text_data=json.dumps(event["data"]))

    async def trip_update(self, event):
        await self.send(text_data=json.dumps(event["data"]))


class RoutePassengerTrackingConsumer(BaseAuthenticatedConsumer):
    """
    Consumer for driver to receive real-time passenger locations on a route.
    Groups: route_passengers_{route_id}
    """
    async def connect(self):
        await super().connect()
        self.route_id = str(self.scope['url_route']['kwargs']['route_id'])
        self.group_name = f"route_passengers_{self.route_id}"

        await self.channel_layer.group_add(
            self.group_name,
            self.channel_name
        )
        logger.info(f"Driver connected to route passengers: {self.group_name}")

    async def disconnect(self, close_code):
        if not hasattr(self, 'group_name'):
            return
        await self.channel_layer.group_discard(
            self.group_name,
            self.channel_name
        )
        logger.info(f"Driver disconnected from route passengers: {self.group_name}")

    async def passenger_update(self, event):
        await self.send(text_data=json.dumps(event["data"]))

    async def passenger_batch(self, event):
        await self.send(text_data=json.dumps(event["data"]))

    async def boarding_update(self, event):
        await self.send(text_data=json.dumps(event["data"]))


class RideRequestConsumer(BaseAuthenticatedConsumer):
    """
    Consumer for driver to receive ride requests.
    Groups: driver_{driver_id}
    """
    async def connect(self):
        await super().connect()
        self.driver_id = str(self.user.id)
        self.group_name = f"driver_{self.driver_id}"

        await self.channel_layer.group_add(
            self.group_name,
            self.channel_name
        )
        logger.info(f"Driver connected to ride requests: {self.group_name}")

    async def disconnect(self, close_code):
        if not hasattr(self, 'group_name'):
            return
        await self.channel_layer.group_discard(
            self.group_name,
            self.channel_name
        )
        logger.info(f"Driver disconnected from ride requests: {self.group_name}")

    async def ride_request(self, event):
        await self.send(text_data=json.dumps(event["data"]))

    async def ride_update(self, event):
        await self.send(text_data=json.dumps(event["data"]))
