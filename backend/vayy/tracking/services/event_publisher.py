import json
from communication.services.rabbitmq_service import RabbitMQService
from common.constants import RIDE_REQUEST_KEY, RIDE_LIFECYCLE_KEY


class TrackingEventPublisher:

    @staticmethod
    def publish_ride_request(payload: dict):
        from common.constants import EXCHANGE_MATCHING
        RabbitMQService.publish(
            exchange=EXCHANGE_MATCHING,
            routing_key=RIDE_REQUEST_KEY,
            payload=payload,
        )

    @staticmethod
    def publish_ride_lifecycle(payload: dict):
        from common.constants import EXCHANGE_MATCHING
        RabbitMQService.publish(
            exchange=EXCHANGE_MATCHING,
            routing_key=RIDE_LIFECYCLE_KEY,
            payload=payload,
        )

    @staticmethod
    def publish_boarding_event(payload: dict):
        from common.constants import EXCHANGE_BOARDING
        RabbitMQService.publish(
            exchange=EXCHANGE_BOARDING,
            routing_key="boarding.request.event",
            payload=payload,
        )

    @staticmethod
    def publish_eta_update(payload: dict):
        """
        ETA change for a trip.

        Published on the trip exchange rather than the channel layer so ETA
        consumers outside this process (the trip stream, admin console) see the
        same events the live path does. Referenced by ETAService; it was called
        but never defined, so every ETA refresh raised AttributeError and the
        cache was never even written.
        """
        from common.constants import EXCHANGE_TRIP, RK_TRIP_LOCATION
        RabbitMQService.publish(
            exchange=EXCHANGE_TRIP,
            routing_key=RK_TRIP_LOCATION,
            payload=payload,
        )
