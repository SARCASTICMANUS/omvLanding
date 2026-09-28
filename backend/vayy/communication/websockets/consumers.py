import json
import logging
from channels.db import database_sync_to_async
from channels.generic.websocket import AsyncWebsocketConsumer
from common.websockets.auth import subprotocol_to_echo, token_from_scope
from rest_framework_simplejwt.authentication import JWTAuthentication

logger = logging.getLogger(__name__)


class NotificationConsumer(AsyncWebsocketConsumer):
    """
    Consumer for real-time user notifications.
    Groups: notifications_{user_id}

    Authenticates via JWT token in query string and validates
    that the authenticated user matches the user_id in the URL.
    """
    async def connect(self):
        # Shared transport: Sec-WebSocket-Protocol first, legacy "?token="
        # only while WS_ALLOW_QUERY_STRING_TOKEN is on.
        token, _legacy = token_from_scope(self.scope)

        user = await self._authenticate_token(token) if token else None
        if not user:
            await self.close(code=4001)
            return

        self.user_id = self.scope['url_route']['kwargs']['user_id']

        # Only allow users to subscribe to their own notifications
        if str(user.id) != str(self.user_id):
            await self.close(code=4003)
            return

        self.scope['user'] = user
        self.user = user
        self.group_name = f"notifications_{self.user_id}"

        # Join notification group
        await self.channel_layer.group_add(
            self.group_name,
            self.channel_name
        )

        await self.accept(subprotocol=subprotocol_to_echo(self.scope))
        logger.info(f"WebSocket connected to {self.group_name}")

    @database_sync_to_async
    def _authenticate_token(self, token):
        try:
            auth = JWTAuthentication()
            validated_token = auth.get_validated_token(token)
            return auth.get_user(validated_token)
        except Exception:
            return None

    async def disconnect(self, close_code):
        if not hasattr(self, 'group_name'):
            return
        await self.channel_layer.group_discard(
            self.group_name,
            self.channel_name
        )
        logger.info(f"WebSocket disconnected from {self.group_name}")

    async def notification_broadcast(self, event):
        """
        Receive message from group.
        """
        # Send message to WebSocket
        await self.send(text_data=json.dumps(event["data"]))
