import json
import logging

from channels.db import database_sync_to_async
from common.websockets.auth import BaseAuthenticatedConsumer
from operations.models import ActiveTrip, BoardingRequest, DispatchRequest

logger = logging.getLogger(__name__)


@database_sync_to_async
def user_owns_trip(user, trip_id=None, dispatch_id=None):
    """
    True when the user is the trip's driver or a passenger boarding it.

    ActiveTrip has no passenger FK - the passenger link lives on
    BoardingRequest, so a trip's participants are the driver plus every
    passenger with a boarding request against it.
    """
    resource_id = trip_id or dispatch_id
    if resource_id is None:
        return False
    trip = (
        ActiveTrip.objects.filter(id=resource_id)
        .only("id", "driver_id")
        .first()
    )
    if trip is None:
        return False
    if trip.driver_id == user.id:
        return True
    return BoardingRequest.objects.filter(trip_id=trip.id, passenger_id=user.id).exists()


@database_sync_to_async
def user_owns_dispatch_request(user, request_id):
    """True only for the passenger who raised the broadcast dispatch request."""
    return DispatchRequest.objects.filter(id=request_id, passenger_id=user.id).exists()


class DispatchStatusConsumer(BaseAuthenticatedConsumer):
    """
    Consumer for real-time dispatch status updates.
    Groups: dispatch_{trip_id}

    Restricted to the trip's driver and its boarding passengers: the payload
    carries the trip OTP (see DispatchService._notify_ws on accept), driver
    name and vehicle number.
    """

    resource_name = "dispatch"
    owner_resolver = staticmethod(user_owns_trip)

    async def connect(self):
        await super().connect()
        if not self.authorized:
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

    Restricted to the requesting passenger - the 'request_accepted' payload
    carries the trip OTP plus pickup and drop coordinates.
    """

    resource_name = "dispatch-broadcast"
    owner_resolver = staticmethod(user_owns_dispatch_request)

    async def connect(self):
        await super().connect()
        if not self.authorized:
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
