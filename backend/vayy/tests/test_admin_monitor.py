"""
Operations-console live monitor tests.

Covers the parts of ``AdminMonitorConsumer`` that are easy to get wrong and
impossible to notice in staging: the staff gate (this group carries every
vehicle's live position, so a non-staff subscriber would be a platform-wide
location leak), the snapshot-on-connect handshake, and the fact that the
relayed ``vehicle_update`` payload reaches the console byte-identical to what
``vehicle_``/``trip_`` subscribers already receive.

Needs the real Django + Channels stack, so it runs under
``manage.py test`` inside the container, not under bare pytest.
"""

import json

from channels.testing import WebsocketCommunicator
from django.contrib.gis.geos import LineString, Point
from django.test import TransactionTestCase
from django.utils import timezone
from rest_framework_simplejwt.tokens import RefreshToken

from accounts.models import User
from common.constants import (
    ROLE_ADMIN,
    ROLE_AUTO_DRIVER,
    VEHICLE_TYPE_AUTO,
    WS_GROUP_ADMIN_FLEET,
)
from common.websockets.auth import WS_SUBPROTOCOL
from operations.models import ActiveTrip, Vehicle, VehicleState
from transport.models import City, Route
from vayy.asgi import application

MONITOR_PATH = "/ws/admin/monitor/"


def token_for(user):
    return str(RefreshToken.for_user(user).access_token)


def subprotocol_headers(user):
    """Mirrors what the browser sends: [label, token]."""
    return [("host", "testserver"), ("origin", "http://testserver")]


class AdminMonitorAuthTests(TransactionTestCase):
    def setUp(self):
        self.admin = User.objects.create_user(
            email="ops@example.com",
            password="Str0ngPass!23",
            role=ROLE_ADMIN,
        )
        self.driver = User.objects.create_user(
            email="driver@example.com",
            password="Str0ngPass!23",
            role=ROLE_AUTO_DRIVER,
        )

    async def _connect(self, token, user):
        communicator = WebsocketCommunicator(
            application,
            MONITOR_PATH,
            headers=subprotocol_headers(user),
            subprotocols=[WS_SUBPROTOCOL, token] if token else [],
        )
        return communicator

    async def test_non_staff_is_denied(self):
        """A driver must not be able to watch the whole fleet."""
        communicator = await self._connect(token_for(self.driver), self.driver)
        connected, _ = await communicator.connect()
        self.assertFalse(connected)
        await communicator.disconnect()

    async def test_missing_token_is_denied(self):
        communicator = await self._connect(None, self.admin)
        connected, _ = await communicator.connect()
        self.assertFalse(connected)
        await communicator.disconnect()

    async def test_invalid_token_is_denied(self):
        communicator = await self._connect("not-a-real-jwt", self.admin)
        connected, _ = await communicator.connect()
        self.assertFalse(connected)
        await communicator.disconnect()

    async def test_staff_user_receives_snapshot(self):
        communicator = await self._connect(token_for(self.admin), self.admin)
        connected, _ = await communicator.connect()
        self.assertTrue(connected)

        response = await communicator.receive_from(timeout=5)
        message = json.loads(response)
        self.assertEqual(message["type"], "snapshot")
        self.assertIn("vehicles", message["data"])
        self.assertIn("trips", message["data"])

        await communicator.disconnect()

    async def test_vehicle_update_is_relayed_unchanged(self):
        """The console must not get a reshaped payload - AGENTS.md forbids
        changing existing WebSocket message formats."""
        communicator = await self._connect(token_for(self.admin), self.admin)
        connected, _ = await communicator.connect()
        self.assertTrue(connected)
        await communicator.receive_from(timeout=5)  # snapshot

        payload = {
            "type": "vehicle_update",
            "lat": 28.6139,
            "lng": 77.209,
            "speed": 31.5,
            "heading": 90.0,
            "vehicle_id": "vehicle-1",
            "trip_id": "trip-1",
            "hot": True,
            "timestamp": "2026-09-27T00:00:00+00:00",
        }
        await self.channel_layer_group_send(payload)

        response = await communicator.receive_from(timeout=5)
        message = json.loads(response)
        self.assertEqual(message["type"], "vehicle_update")
        self.assertEqual(message["data"], payload)

        await communicator.disconnect()

    async def channel_layer_group_send(self, payload):
        from channels.layers import get_channel_layer

        layer = get_channel_layer()
        await layer.group_send(
            WS_GROUP_ADMIN_FLEET,
            {"type": "vehicle_update", "data": payload},
        )


class AdminMonitorSnapshotTests(TransactionTestCase):
    def setUp(self):
        self.admin = User.objects.create_user(
            email="ops2@example.com",
            password="Str0ngPass!23",
            role=ROLE_ADMIN,
        )
        self.driver = User.objects.create_user(
            email="driver2@example.com",
            password="Str0ngPass!23",
            role=ROLE_AUTO_DRIVER,
        )
        self.city = City.objects.create(
            name="Testville", state="TS", country="IN"
        )
        self.route = Route.objects.create(
            city=self.city,
            name="Route 1",
            route_code="R1",
            path=LineString((77.20, 28.61), (77.22, 28.63)),
            start_name="A",
            end_name="B",
            total_distance_meters=1000.0,
        )

    async def test_snapshot_includes_online_vehicle_with_position(self):
        vehicle = Vehicle.objects.create(
            city=self.city,
            route=self.route,
            driver=self.driver,
            vehicle_number="DL-1",
            vehicle_type=VEHICLE_TYPE_AUTO,
            status="approved",
            is_active=True,
        )
        trip = ActiveTrip.objects.create(
            vehicle=vehicle,
            route=self.route,
            driver=self.driver,
            status="active",
            direction="outbound",
        )
        VehicleState.objects.create(
            vehicle=vehicle,
            active_trip=trip,
            current_location=Point(77.209, 28.6139),
            speed_kmph=24.0,
            heading=180.0,
            last_updated=timezone.now(),
        )

        communicator = WebsocketCommunicator(
            application,
            MONITOR_PATH,
            headers=subprotocol_headers(self.admin),
            subprotocols=[WS_SUBPROTOCOL, token_for(self.admin)],
        )
        connected, _ = await communicator.connect()
        self.assertTrue(connected)

        message = json.loads(await communicator.receive_from(timeout=5))
        self.assertEqual(message["type"], "snapshot")

        rows = message["data"]["vehicles"]
        self.assertEqual(len(rows), 1)
        row = rows[0]
        self.assertTrue(row["online"])
        self.assertAlmostEqual(row["lat"], 28.6139, places=4)
        self.assertAlmostEqual(row["lng"], 77.209, places=4)
        self.assertEqual(row["vehicle_number"], "DL-1")
        self.assertEqual(row["trip_status"], "active")

        trips = message["data"]["trips"]
        self.assertEqual(len(trips), 1)
        self.assertEqual(trips[0]["status"], "active")

        await communicator.disconnect()

    async def test_stale_vehicle_is_reported_offline(self):
        """A vehicle that stopped reporting must not stay on the map forever."""
        from datetime import timedelta

        vehicle = Vehicle.objects.create(
            city=self.city,
            route=self.route,
            driver=self.driver,
            vehicle_number="DL-STALE",
            vehicle_type=VEHICLE_TYPE_AUTO,
            status="approved",
            is_active=True,
        )
        VehicleState.objects.create(
            vehicle=vehicle,
            current_location=Point(77.209, 28.6139),
            speed_kmph=0.0,
            heading=0.0,
            last_updated=timezone.now() - timedelta(minutes=30),
        )

        communicator = WebsocketCommunicator(
            application,
            MONITOR_PATH,
            headers=subprotocol_headers(self.admin),
            subprotocols=[WS_SUBPROTOCOL, token_for(self.admin)],
        )
        connected, _ = await communicator.connect()
        self.assertTrue(connected)

        message = json.loads(await communicator.receive_from(timeout=5))
        rows = message["data"]["vehicles"]
        self.assertEqual(len(rows), 1)
        self.assertFalse(rows[0]["online"])
        self.assertIsNone(rows[0]["lat"])

        await communicator.disconnect()
