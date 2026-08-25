import logging
from django.db import transaction
from asgiref.sync import async_to_sync
from channels.layers import get_channel_layer

from operations.models import (
    BoardingRequest,
)

from operations.constants import (
    BOARDING_PENDING,
    BOARDING_CANCELLED,
)

from operations.selectors.boarding_selector import (
    BoardingSelector,
)

from communication.services.rabbitmq_service import (
    RabbitMQService,
)

from communication.constants import (
    EXCHANGE_BOARDING,
    RK_BOARDING_CREATED,
    RK_BOARDING_CANCELLED,
    RK_BOARDING_BOARDED,
)

logger = logging.getLogger(__name__)


class BoardingService:

    @staticmethod
    def _notify_driver_boarding_update(trip, passenger_id, passenger_name, event_type, boarding_request_id, pickup_stop_name=None):
        """
        Send real-time WS notification to driver when a passenger raises/lowers hand.
        Uses route_passengers_{route_id} group so the RoutePassengerTrackingConsumer receives it.
        """
        try:
            channel_layer = get_channel_layer()
            route_id = str(trip.route_id)

            ws_payload = {
                "type": "passenger_update",
                "data": {
                    "type": "boarding_update",
                    "event": event_type,
                    "user_id": str(passenger_id),
                    "passenger_name": passenger_name,
                    "boarding_request_id": str(boarding_request_id),
                    "pickup_stop_name": pickup_stop_name or "",
                    "hand_raised": event_type == "hand_raised",
                }
            }

            async_to_sync(channel_layer.group_send)(
                f"route_passengers_{route_id}",
                ws_payload,
            )

            logger.info(f"Boarding WS notification sent: {event_type} for passenger {passenger_id} on route {route_id}")
        except Exception as e:
            logger.error(f"Failed to send boarding WS notification: {e}")

    @staticmethod
    @transaction.atomic
    def create_request(
        passenger,
        trip,
        pickup_stop,
        drop_stop=None,
    ):
        existing = (
            BoardingSelector.get_pending_request(
                passenger.id,
                trip.id,
            )
        )

        if existing:
            return existing

        request = (
            BoardingRequest.objects.create(
                passenger=passenger,
                trip=trip,
                pickup_stop=pickup_stop,
                drop_stop=drop_stop,
                status=BOARDING_PENDING,
            )
        )

        # Publish to RabbitMQ for async processing
        try:
            RabbitMQService.publish(
                exchange=EXCHANGE_BOARDING,
                routing_key=RK_BOARDING_CREATED,
                payload={
                    "request_id": str(request.id),
                    "trip_id": str(trip.id),
                    "passenger_id": str(passenger.id),
                    "passenger_name": passenger.get_full_name() or passenger.email,
                    "pickup_stop_name": pickup_stop.name,
                },
            )
        except Exception as e:
            logger.error(f"Failed to publish boarding created to RabbitMQ: {e}")

        # Send real-time WS notification to driver
        BoardingService._notify_driver_boarding_update(
            trip=trip,
            passenger_id=passenger.id,
            passenger_name=passenger.get_full_name() or passenger.email,
            event_type="hand_raised",
            boarding_request_id=request.id,
            pickup_stop_name=pickup_stop.name,
        )

        return request

    @staticmethod
    @transaction.atomic
    def cancel_request(
        request_id,
    ):
        request = (
            BoardingSelector.get_request(
                request_id
            )
        )

        trip = request.trip
        passenger = request.passenger

        request.status = (
            BOARDING_CANCELLED
        )

        request.save(
            update_fields=[
                "status",
                "updated_at",
            ]
        )

        # Publish to RabbitMQ for async processing
        try:
            RabbitMQService.publish(
                exchange=EXCHANGE_BOARDING,
                routing_key=RK_BOARDING_CANCELLED,
                payload={
                    "request_id": str(request.id),
                    "trip_id": str(trip.id),
                    "passenger_id": str(passenger.id),
                },
            )
        except Exception as e:
            logger.error(f"Failed to publish boarding cancelled to RabbitMQ: {e}")

        # Send real-time WS notification to driver
        BoardingService._notify_driver_boarding_update(
            trip=trip,
            passenger_id=passenger.id,
            passenger_name=passenger.get_full_name() or passenger.email,
            event_type="hand_lowered",
            boarding_request_id=request.id,
        )

        return request

    @staticmethod
    @transaction.atomic
    def mark_boarded(
        request_id,
    ):
        request = (
            BoardingSelector.get_request(
                request_id
            )
        )

        trip = request.trip

        request.status = "boarded"

        request.save(
            update_fields=[
                "status",
                "updated_at",
            ]
        )

        # Publish to RabbitMQ for async processing
        try:
            RabbitMQService.publish(
                exchange=EXCHANGE_BOARDING,
                routing_key=RK_BOARDING_BOARDED,
                payload={
                    "request_id": str(request.id),
                    "trip_id": str(trip.id),
                    "passenger_id": str(request.passenger.id),
                },
            )
        except Exception as e:
            logger.error(f"Failed to publish boarding boarded to RabbitMQ: {e}")

        # Send real-time WS notification to driver
        BoardingService._notify_driver_boarding_update(
            trip=trip,
            passenger_id=request.passenger.id,
            passenger_name=request.passenger.get_full_name() or request.passenger.email,
            event_type="boarded",
            boarding_request_id=request.id,
        )

        return request
