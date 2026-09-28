"""
Operations-console live monitor.

The per-vehicle and per-trip groups (``vehicle_{id}``, ``trip_{id}``) are
correctly owner-scoped: ``user_owns_vehicle`` admits only the assigned driver,
so an admin cannot join them, and even if they could the console would need one
socket per vehicle - browsers cap concurrent sockets per origin.

So the fleet is fanned out to a single group, ``admin_fleet``, which every GPS
fix is mirrored to (see ``LocationService.hot_path_process_async``). This
consumer is the only thing that may join it, because the group carries the live
position of every vehicle on the platform.

Access is staff/admin only, enforced as an ``owner_resolver`` so the handshake
is rejected before this socket ever becomes a group member. This is deliberately
stricter than the read-only admin endpoints: a city admin who can reach this
socket sees the whole fleet, not one city.
"""

import json
import logging

from channels.db import database_sync_to_async
from django.utils import timezone

from common.constants import (
    ROLE_ADMIN,
    TRIP_STATUS_ACCEPTED,
    TRIP_STATUS_ACTIVE,
    TRIP_STATUS_ARRIVED,
    TRIP_STATUS_ASSIGNED,
    TRIP_STATUS_REQUESTED,
    WS_GROUP_ADMIN_FLEET,
)
from common.websockets.auth import BaseAuthenticatedConsumer
from operations.models import ActiveTrip, Vehicle

logger = logging.getLogger(__name__)

# Statuses that mean "this trip is in the system right now". A
# requested/assigned trip has no moving vehicle yet, so the console shows it as
# pending rather than plotting a marker for it.
LIVE_TRIP_STATUSES = (
    TRIP_STATUS_REQUESTED,
    TRIP_STATUS_ASSIGNED,
    TRIP_STATUS_ACCEPTED,
    TRIP_STATUS_ARRIVED,
    TRIP_STATUS_ACTIVE,
)

# A vehicle whose state row has not been touched for this long is treated as
# offline. GPS pings arrive every few seconds; without a staleness bound a
# vehicle that dropped off the network would stay on the map forever.
STALE_AFTER_SECONDS = 90


@database_sync_to_async
def user_is_ops_staff(user, **_kwargs):
    """Platform staff or an admin-role account."""
    return bool(user.is_staff or getattr(user, "role", None) == ROLE_ADMIN)


@database_sync_to_async
def build_snapshot():
    """
    Initial paint for the console: every active vehicle with its last known
    position and staleness, plus the trips currently in flight. Sent once on
    connect so the map is populated immediately instead of waiting for each
    vehicle's next GPS fix.
    """
    cutoff = timezone.now() - timezone.timedelta(seconds=STALE_AFTER_SECONDS)

    vehicles = list(
        Vehicle.objects.filter(is_active=True).select_related(
            "city", "route", "driver", "vehicle_state"
        )
    )
    trips = list(
        ActiveTrip.objects.filter(status__in=LIVE_TRIP_STATUSES).select_related(
            "vehicle", "route", "driver"
        )
    )

    trip_by_vehicle = {t.vehicle_id: t for t in trips if t.vehicle_id}

    vehicle_rows = []
    for vehicle in vehicles:
        state = getattr(vehicle, "vehicle_state", None)
        last_seen = state.last_updated if state else None
        online = bool(last_seen and last_seen >= cutoff)

        lat = lng = speed = heading = None
        if online and state is not None and state.current_location is not None:
            lng, lat = state.current_location.x, state.current_location.y
            speed = state.speed_kmph
            heading = state.heading

        trip = trip_by_vehicle.get(vehicle.id)
        vehicle_rows.append(
            {
                "vehicle_id": str(vehicle.id),
                "vehicle_number": vehicle.vehicle_number,
                "vehicle_type": vehicle.vehicle_type,
                "status": vehicle.status,
                "city_id": str(vehicle.city_id) if vehicle.city_id else None,
                "route_id": str(vehicle.route_id) if vehicle.route_id else None,
                "driver_id": str(vehicle.driver_id) if vehicle.driver_id else None,
                "online": online,
                "lat": lat,
                "lng": lng,
                "speed": speed,
                "heading": heading,
                "last_seen": last_seen.isoformat() if last_seen else None,
                "trip_id": str(trip.id) if trip else None,
                "trip_status": trip.status if trip else None,
            }
        )

    trip_rows = [
        {
            "trip_id": str(trip.id),
            "vehicle_id": str(trip.vehicle_id) if trip.vehicle_id else None,
            "route_id": str(trip.route_id) if trip.route_id else None,
            "driver_id": str(trip.driver_id) if trip.driver_id else None,
            "status": trip.status,
            "direction": trip.direction,
            "total_fare": (
                str(trip.total_fare) if trip.total_fare is not None else None
            ),
            "started_at": (
                trip.started_at.isoformat() if trip.started_at else None
            ),
            "last_updated": (
                trip.last_updated.isoformat() if trip.last_updated else None
            ),
        }
        for trip in trips
    ]

    return {
        "vehicles": vehicle_rows,
        "trips": trip_rows,
        "generated_at": timezone.now().isoformat(),
    }


class AdminMonitorConsumer(BaseAuthenticatedConsumer):
    """
    Single-socket fleet + trip feed for the operations console.

    ``receive`` is intentionally not an ingest path: unlike
    ``VehicleTrackingConsumer`` this socket never writes telemetry, it only
    reads the fan-out. Client frames are limited to a liveness ping.
    """

    resource_name = "admin_monitor"
    owner_resolver = staticmethod(user_is_ops_staff)

    async def connect(self):
        await super().connect()
        if not self.authorized:
            return

        self.group_name = WS_GROUP_ADMIN_FLEET

        await self.channel_layer.group_add(self.group_name, self.channel_name)
        logger.info(
            f"WebSocket connected to {self.group_name} (admin={self.user.id})"
        )

        try:
            snapshot = await build_snapshot()
        except Exception:
            logger.exception(f"Admin monitor snapshot failed (admin={self.user.id})")
            snapshot = {"vehicles": [], "trips": [], "error": "snapshot_failed"}

        await self.send(
            text_data=json.dumps({"type": "snapshot", "data": snapshot})
        )

    async def disconnect(self, close_code):
        if not hasattr(self, "group_name"):
            return
        await self.channel_layer.group_discard(self.group_name, self.channel_name)
        logger.info(f"WebSocket disconnected from {self.group_name}")

    async def receive(self, text_data=None, bytes_data=None):
        """Liveness only - this socket is read-only by design."""
        if not text_data:
            return
        try:
            message = json.loads(text_data)
        except (json.JSONDecodeError, TypeError):
            return
        if message.get("type") == "ping":
            await self.send(text_data=json.dumps({"type": "pong"}))

    async def vehicle_update(self, event):
        """Mirrors the existing vehicle_update payload, unmodified."""
        await self.send(
            text_data=json.dumps({"type": "vehicle_update", "data": event["data"]})
        )
