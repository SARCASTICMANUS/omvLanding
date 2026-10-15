"""Realtime invalidation feed used by passenger bike corridor search."""

import json

from channels.layers import get_channel_layer
from channels.testing import WebsocketCommunicator
from django.test import TransactionTestCase, override_settings
from rest_framework_simplejwt.tokens import RefreshToken

from accounts.models import User
from common.websockets.auth import WS_SUBPROTOCOL
from vayy.asgi import application


@override_settings(CHANNEL_LAYERS={
    "default": {"BACKEND": "channels.layers.InMemoryChannelLayer"}
})
class JourneySearchWebSocketTests(TransactionTestCase):
    def setUp(self):
        self.passenger = User.objects.create_user(
            email="journey-search-passenger@example.test",
            password="test-password",
            role="passenger",
        )

    async def test_authenticated_passenger_receives_search_invalidation(self):
        token = str(RefreshToken.for_user(self.passenger).access_token)
        communicator = WebsocketCommunicator(
            application,
            "/ws/tracking/journey-search/",
            headers=[("host", "testserver"), ("origin", "http://testserver")],
            subprotocols=[WS_SUBPROTOCOL, token],
        )
        connected, _ = await communicator.connect()
        self.assertTrue(connected)

        payload = {
            "type": "journey_search_update",
            "updated_at": "2026-10-15T11:00:00+00:00",
        }
        await get_channel_layer().group_send(
            "journey_search",
            {"type": "journey_search_update", "data": payload},
        )
        received = json.loads(await communicator.receive_from(timeout=5))
        self.assertEqual(received, payload)
        await communicator.disconnect()

    async def test_missing_token_is_denied(self):
        communicator = WebsocketCommunicator(
            application,
            "/ws/tracking/journey-search/",
            headers=[("host", "testserver"), ("origin", "http://testserver")],
        )
        connected, _ = await communicator.connect()
        self.assertFalse(connected)
        await communicator.disconnect()
