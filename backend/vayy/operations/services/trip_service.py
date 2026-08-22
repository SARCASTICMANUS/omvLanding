from django.db import transaction
from django.utils import timezone

from operations.models import (
    ActiveTrip,
)

from operations.constants import (
    TRIP_STATUS_ACTIVE,
    TRIP_STATUS_COMPLETED,
    TRIP_STARTED,
    TRIP_COMPLETED,
    TRIP_LOCATION,
)

from communication.constants import EXCHANGE_TRIP

from operations.selectors.trip_selector import (
    TripSelector,
)

from communication.services.rabbitmq_service import (
    RabbitMQService,
)

from tracking.services.redis_geo_service import RedisGeoService


class TripService:

    @staticmethod
    @transaction.atomic
    def start_trip(
        vehicle,
        route,
        driver,
        trip_schedule=None,
    ):
        existing_trip = (
            TripSelector.get_driver_active_trip(
                driver.id
            )
        )

        if existing_trip:
            raise ValueError(
                "Driver already has active trip."
            )

        trip = ActiveTrip.objects.create(
            vehicle=vehicle,
            route=route,
            driver=driver,
            trip_schedule=trip_schedule,
            status=TRIP_STATUS_ACTIVE,
        )

        RabbitMQService.publish(
            exchange=EXCHANGE_TRIP,
            routing_key=TRIP_STARTED,
            payload={
                "trip_id": str(trip.id),
                "vehicle_id": str(vehicle.id),
                "driver_id": str(driver.id),
            },
        )

        return trip

    @staticmethod
    @transaction.atomic
    def complete_trip(
        trip_id,
    ):
        trip = (
            TripSelector.get_trip(
                trip_id
            )
        )

        trip.status = (
            TRIP_STATUS_COMPLETED
        )

        trip.ended_at = (
            timezone.now()
        )

        trip.save(
            update_fields=[
                "status",
                "ended_at",
                "last_updated",
            ]
        )

        # Remove vehicle from Redis GEO set since trip ended
        try:
            RedisGeoService.remove_vehicle(str(trip.vehicle_id))
        except Exception:
            pass

        RabbitMQService.publish(
            exchange=EXCHANGE_TRIP,
            routing_key=TRIP_COMPLETED,
            payload={
                "trip_id": str(trip.id),
            },
        )

        return trip

    @staticmethod
    @transaction.atomic
    def update_location(
        trip,
        point,
    ):
        trip.current_location = point

        trip.save(
            update_fields=[
                "current_location",
                "last_updated",
            ]
        )

        RabbitMQService.publish(
            exchange=EXCHANGE_TRIP,
            routing_key=TRIP_LOCATION,
            payload={
                "trip_id": str(trip.id),
                "lat": point.y,
                "lng": point.x,
            },
        )

        return trip