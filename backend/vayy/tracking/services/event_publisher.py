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