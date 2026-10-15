import json
import logging

from channels.db import database_sync_to_async
from common.websockets.auth import BaseAuthenticatedConsumer
from operations.websockets.consumers import user_owns_trip
from operations.models import ActiveTrip, Vehicle
from tracking.services.location_service import LocationService
from tracking.tasks import process_location_update

logger = logging.getLogger(__name__)


@database_sync_to_async
def user_owns_vehicle(user, vehicle_id):
    """
    True only for the driver the vehicle is assigned to.

    Without this any authenticated user could subscribe to any driver's live
    position feed, and the consumer's receive() handler accepts inbound
    location writes keyed only on the URL-supplied vehicle id.
    """
    return Vehicle.objects.filter(id=vehicle_id, driver_id=user.id).exists()


@database_sync_to_async
def user_drives_route(user, route_id):
    """
    True when the user drives a vehicle serving the given route.

    The route_passengers_ feed carries live passenger coordinates, user ids and
    display names, so it is restricted to the drivers actually working the
    route.
    """
    if Vehicle.objects.filter(route_id=route_id, driver_id=user.id).exists():
        return True
    return ActiveTrip.objects.filter(route_id=route_id, driver_id=user.id).exists()


@database_sync_to_async
def user_may_view_route(user, route_id):
    """
    Route-level vehicle tracking is an intentionally open feed.

    A route is a public transit line: a passenger waiting at a stop has no trip
    on that route yet, so scoping this group to trip participants would break
    the core "watch my bus" flow. Any authenticated user may read it.

    This is deliberately explicit rather than leaving owner_resolver unset, so
    the open policy is auditable in one place. The trip-scoped fields that used
    to leak through this group (trip_id, pickup_distance_km,
    pickup_duration_min) are now nulled before publish in
    LocationService.update_vehicle_state: trip_id would otherwise let every
    route watcher enumerate live trips, and the pickup figures are measured
    against one trip's boarding stop.
    """
    return True


class VehicleTrackingConsumer(BaseAuthenticatedConsumer):
    """
    Consumer for live vehicle tracking.
    Groups: vehicle_{vehicle_id}

    Hot path is fully async: Redis pipeline + Channel layer broadcast.
    Zero DB queries, zero blocking calls. Cold path is fire-and-forget Celery.
    """

    resource_name = "vehicle"
    owner_resolver = staticmethod(user_owns_vehicle)

    async def connect(self):
        await super().connect()
        if not self.authorized:
            return

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


class JourneySearchConsumer(BaseAuthenticatedConsumer):
    """Authenticated invalidation feed; contains no driver coordinates or identities."""

    resource_name = "journey-search"

    async def connect(self):
        await super().connect()
        if not self.authorized:
            return
        self.group_name = "journey_search"
        await self.channel_layer.group_add(self.group_name, self.channel_name)

    async def disconnect(self, close_code):
        if hasattr(self, "group_name"):
            await self.channel_layer.group_discard(self.group_name, self.channel_name)

    async def journey_search_update(self, event):
        await self.send(text_data=json.dumps(event["data"]))


class TripTrackingConsumer(BaseAuthenticatedConsumer):
    """
    Consumer for live trip tracking.
    Groups: trip_{trip_id}

    Restricted to the trip's driver and boarding passengers.
    """

    resource_name = "trip"
    owner_resolver = staticmethod(user_owns_trip)

    async def connect(self):
        await super().connect()
        if not self.authorized:
            return

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

    Open to any authenticated user - see user_may_view_route for why this is a
    deliberate open feed rather than an oversight.
    """

    resource_name = "route"
    owner_resolver = staticmethod(user_may_view_route)

    async def connect(self):
        await super().connect()
        if not self.authorized:
            return

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

    Restricted to drivers working that route - the feed exposes passenger
    coordinates, user ids and display names.
    """

    resource_name = "route-passengers"
    owner_resolver = staticmethod(user_drives_route)

    async def connect(self):
        await super().connect()
        if not self.authorized:
            return

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


@database_sync_to_async
def user_may_view_stop(user, stop_id):
    """
    True for any authenticated user.

    A global stop is a public boarding point: a passenger standing there has no
    trip yet, and scoping this group to trip participants would break the core
    "see who is coming to my stop" flow. This is the same explicit open policy
    as user_may_view_route, kept here so the decision is auditable in one place.
    """
    return True


class StopTrackingConsumer(BaseAuthenticatedConsumer):
    """
    Live vehicle positions for one stop.

    Groups: stop_{stop_id}

    The journey counterpart of RouteTrackingConsumer. A journey vehicle's
    position is published here whenever its path serves this stop, which is what
    lets a passenger at the stop watch vehicles approach without knowing about
    routes at all.
    """

    resource_name = "stop"
    owner_resolver = staticmethod(user_may_view_stop)

    async def connect(self):
        await super().connect()
        if not self.authorized:
            return

        self.stop_id = str(self.scope['url_route']['kwargs']['stop_id'])
        self.group_name = f"stop_{self.stop_id}"

        await self.channel_layer.group_add(
            self.group_name,
            self.channel_name
        )
        logger.info(f"WebSocket connected to stop {self.group_name}")

    async def disconnect(self, close_code):
        if not hasattr(self, 'group_name'):
            return
        await self.channel_layer.group_discard(
            self.group_name,
            self.channel_name
        )
        logger.info(f"WebSocket disconnected from stop {self.group_name}")

    async def stop_vehicle_update(self, event):
        await self.send(text_data=json.dumps(event["data"]))

    async def vehicle_update(self, event):
        await self.send(text_data=json.dumps(event["data"]))


class RideRequestConsumer(BaseAuthenticatedConsumer):
    """
    Consumer for driver to receive ride requests.
    Groups: driver_{driver_id}

    No owner_resolver needed: the group name is derived from the
    authenticated user's own id, so it cannot be pointed at another driver.
    """

    resource_name = "ride-requests"

    async def connect(self):
        await super().connect()
        if not self.authorized:
            return

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
