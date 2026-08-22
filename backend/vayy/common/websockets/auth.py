import json
import logging
from channels.generic.websocket import AsyncWebsocketConsumer
from channels.db import database_sync_to_async
from rest_framework_simplejwt.authentication import JWTAuthentication

logger = logging.getLogger(__name__)

class BaseAuthenticatedConsumer(AsyncWebsocketConsumer):
    """
    Base consumer with JWT authentication for WebSockets.
    """
    async def connect(self):
        # Extract token from query params or headers
        token = self.scope.get('query_string', b'').decode().split('=')[-1]
        
        if not token:
            await self.close(code=4001)
            return

        user = await self.authenticate_token(token)
        if user:
            self.scope['user'] = user
            await self.accept()
            logger.info(f"User {user.id} connected to WebSocket")
        else:
            await self.close(code=4001)
            logger.warning("WebSocket connection attempt with invalid token")

    @database_sync_to_async
    def authenticate_token(self, token):
        try:
            auth = JWTAuthentication()
            validated_token = auth.get_validated_token(token)
            return auth.get_user(validated_token)
        except Exception:
            return None
