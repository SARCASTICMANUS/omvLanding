"""Realtime invalidation feed used by passenger bike corridor search."""

import json

from channels.layers import get_channel_layer
from channels.testing import WebsocketCommunicator
from django.test import TransactionTestCase, override_settings
from rest_framework_simplejwt.tokens import RefreshToken

from accounts.models import User
from common.websockets.auth import WS_SUBPROTOCOL
from operations.models import ActiveTrip, Vehicle
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


@override_settings(CHANNEL_LAYERS={
    "default": {"BACKEND": "channels.layers.InMemoryChannelLayer"}
})
class DispatchStatusWebSocketTests(TransactionTestCase):
    def setUp(self):
        self.driver = User.objects.create_user(
            email="dispatch-ws-driver@example.test",
            password="test-password",
            role="bikedriver",
        )
        self.other_user = User.objects.create_user(
            email="dispatch-ws-other@example.test",
            password="test-password",
            role="passenger",
        )
        vehicle = Vehicle.objects.create(
            vehicle_number="DISPATCH-WS-1",
            vehicle_type="bike",
            driver=self.driver,
        )
        self.trip = ActiveTrip.objects.create(
            vehicle=vehicle,
            driver=self.driver,
            route=None,
            status="active",
        )

    async def _connect(self, user, path):
        token = str(RefreshToken.for_user(user).access_token)
        communicator = WebsocketCommunicator(
            application,
            path,
            headers=[("host", "testserver"), ("origin", "http://testserver")],
            subprotocols=[WS_SUBPROTOCOL, token],
        )
        connected, _ = await communicator.connect()
        await communicator.disconnect()
        return connected

    async def test_trip_driver_can_connect_with_dispatch_id_route_kwarg(self):
        self.assertTrue(await self._connect(
            self.driver, f"/ws/dispatch/{self.trip.id}/"
        ))

    async def test_trip_driver_can_connect_with_trip_id_route_kwarg(self):
        self.assertTrue(await self._connect(
            self.driver, f"/ws/tracking/trip/{self.trip.id}/"
        ))

    async def test_unrelated_user_cannot_connect_to_dispatch(self):
        self.assertFalse(await self._connect(
            self.other_user, f"/ws/dispatch/{self.trip.id}/"
        ))
