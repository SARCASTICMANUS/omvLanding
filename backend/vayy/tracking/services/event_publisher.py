import json
from communication.services.rabbitmq_service import RabbitMQService
from tracking.constants import (
    TRACKING_EXCHANGE,
    GPS_ROUTING_KEY,
    AUTO_GPS_ROUTING_KEY,
    BIKE_GPS_ROUTING_KEY,
    TRIP_LOCATION_KEY,
    ETA_UPDATE_KEY,
    PASSENGER_LOCATION_KEY,
    RIDE_REQUEST_KEY,
    RIDE_LIFECYCLE_KEY,
)


class TrackingEventPublisher:

    @staticmethod
    def publish_gps_update(payload: dict):
        RabbitMQService.publish(
            exchange=TRACKING_EXCHANGE,
            routing_key=GPS_ROUTING_KEY,
            payload=payload,
        )

    @staticmethod
    def publish_auto_gps(payload: dict):
        RabbitMQService.publish(
            exchange=TRACKING_EXCHANGE,
            routing_key=AUTO_GPS_ROUTING_KEY,
            payload=payload,
        )

    @staticmethod
    def publish_bike_gps(payload: dict):
        RabbitMQService.publish(
            exchange=TRACKING_EXCHANGE,
            routing_key=BIKE_GPS_ROUTING_KEY,
            payload=payload,
        )

    @staticmethod
    def publish_trip_location(payload: dict):
        RabbitMQService.publish(
            exchange=TRACKING_EXCHANGE,
            routing_key=TRIP_LOCATION_KEY,
            payload=payload,
        )

    @staticmethod
    def publish_eta_update(payload: dict):
        RabbitMQService.publish(
            exchange=TRACKING_EXCHANGE,
            routing_key=ETA_UPDATE_KEY,
            payload=payload,
        )

    @staticmethod
    def publish_passenger_location(payload: dict):
        RabbitMQService.publish(
            exchange=TRACKING_EXCHANGE,
            routing_key=PASSENGER_LOCATION_KEY,
            payload=payload,
        )

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