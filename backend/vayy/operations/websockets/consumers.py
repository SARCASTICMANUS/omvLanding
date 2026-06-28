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
