from django.db import transaction

from operations.models import (
    Vehicle,
)

from operations.selectors.vehicle_selector import (
    VehicleSelector,
)

from tracking.services.redis_geo_service import RedisGeoService


class VehicleService:

    @staticmethod
    @transaction.atomic
    def assign_driver(
        vehicle_id,
        driver,
    ):
        vehicle = (
            VehicleSelector.get_vehicle(
                vehicle_id
            )
        )

        vehicle.driver = driver
        vehicle.save(
            update_fields=[
                "driver",
                "updated_at",
            ]
        )

        return vehicle

    @staticmethod
    @transaction.atomic
    def unassign_driver(
        vehicle_id,
    ):
        vehicle = (
            VehicleSelector.get_vehicle(
                vehicle_id
            )
        )

        vehicle.driver = None

        vehicle.save(
            update_fields=[
                "driver",
                "updated_at",
            ]
        )

        return vehicle

    @staticmethod
    @transaction.atomic
    def activate_vehicle(
        vehicle_id,
    ):
        vehicle = (
            VehicleSelector.get_vehicle(
                vehicle_id
            )
        )

        vehicle.is_active = True

        vehicle.save(
            update_fields=[
                "is_active",
                "updated_at",
            ]
        )

        return vehicle

    @staticmethod
    @transaction.atomic
    def deactivate_vehicle(
        vehicle_id,
    ):
        vehicle = (
            VehicleSelector.get_vehicle(
                vehicle_id
            )
        )

        vehicle.is_active = False

        vehicle.save(
            update_fields=[
                "is_active",
                "updated_at",
            ]
        )

        # Remove vehicle from Redis GEO set since it's deactivated
        try:
            RedisGeoService.remove_vehicle(str(vehicle_id))
        except Exception:
            pass

        return vehicle