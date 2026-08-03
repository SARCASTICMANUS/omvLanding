import json
import logging
from common.websockets.auth import BaseAuthenticatedConsumer

logger = logging.getLogger(__name__)

class DispatchStatusConsumer(BaseAuthenticatedConsumer):
    """
    Consumer for real-time dispatch status updates.
    Groups: dispatch_{dispatch_id}
    """
    async def connect(self):
        await super().connect()
        if self.scope.get('user') is None:
            return

        self.dispatch_id = self.scope['url_route']['kwargs']['dispatch_id']
        self.group_name = f"dispatch_{self.dispatch_id}"

        # Join dispatch group
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

    async def dispatch_update(self, event):
        """
        Receive message from group.
        """
        # Send message to WebSocket
        await self.send(text_data=json.dumps(event["data"]))


class DispatchBroadcastConsumer(BaseAuthenticatedConsumer):
    """
    Consumer for broadcast dispatch updates (passenger side).
    Groups: broadcast_{request_id}

    Passenger joins this group after creating a broadcast request.
    Receives: driver accepted, request expired, no drivers available.
    """
    async def connect(self):
        await super().connect()
        if self.scope.get('user') is None:
            return

        self.request_id = self.scope['url_route']['kwargs']['request_id']
        self.group_name = f"broadcast_{self.request_id}"

        await self.channel_layer.group_add(
            self.group_name,
            self.channel_name
        )
        logger.info(f"Passenger connected to broadcast: {self.group_name}")

    async def disconnect(self, close_code):
        if not hasattr(self, 'group_name'):
            return
        await self.channel_layer.group_discard(
            self.group_name,
            self.channel_name
        )
        logger.info(f"Passenger disconnected from broadcast: {self.group_name}")

    async def broadcast_update(self, event):
        """Forward broadcast status updates to the passenger client."""
        await self.send(text_data=json.dumps(event["data"]))
