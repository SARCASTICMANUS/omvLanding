import json
import logging
from common.websockets.auth import BaseAuthenticatedConsumer
from tracking.tasks import process_location_update

logger = logging.getLogger(__name__)

class VehicleTrackingConsumer(BaseAuthenticatedConsumer):
    """
    Consumer for live vehicle tracking.
    Groups: vehicle_{vehicle_id}
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
        Publishes to RabbitMQ for async processing by Celery.
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
                }
                process_location_update.delay(payload)
                logger.debug(f"Dispatched location for vehicle {self.vehicle_id}")
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


class RoutePassengerTrackingConsumer(BaseAuthenticatedConsumer):
    """
    Consumer for driver to receive real-time passenger locations on a route.
    Groups: route_passengers_{route_id}

    Driver subscribes → receives passenger_update events as passengers
    push their locations via REST API → RabbitMQ → this consumer.
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
        """Receive a passenger location update and forward to driver."""
        await self.send(text_data=json.dumps(event["data"]))

    async def passenger_batch(self, event):
        """Receive a batch of passenger locations (initial load)."""
        await self.send(text_data=json.dumps(event["data"]))

    async def boarding_update(self, event):
        """Receive a boarding update (hand raise/lower) and forward to driver."""
        await self.send(text_data=json.dumps(event["data"]))
