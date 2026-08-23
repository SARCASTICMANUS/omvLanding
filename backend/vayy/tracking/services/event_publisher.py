import json
from communication.services.rabbitmq_service import RabbitMQService
from tracking.constants import RIDE_REQUEST_KEY, RIDE_LIFECYCLE_KEY


class TrackingEventPublisher:

    @staticmethod
    def publish_ride_request(payload: dict):
        from communication.constants import EXCHANGE_MATCHING
        RabbitMQService.publish(
            exchange=EXCHANGE_MATCHING,
            routing_key=RIDE_REQUEST_KEY,
            payload=payload,
        )

    @staticmethod
    def publish_ride_lifecycle(payload: dict):
        from communication.constants import EXCHANGE_MATCHING
        RabbitMQService.publish(
            exchange=EXCHANGE_MATCHING,
            routing_key=RIDE_LIFECYCLE_KEY,
            payload=payload,
        )

    @staticmethod
    def publish_boarding_event(payload: dict):
        from communication.constants import EXCHANGE_BOARDING
        RabbitMQService.publish(
            exchange=EXCHANGE_BOARDING,
            routing_key="boarding.request.event",
            payload=payload,
        )