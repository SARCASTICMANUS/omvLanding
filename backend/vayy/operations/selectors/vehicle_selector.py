from operations.models import (
    Vehicle,
)


class VehicleSelector:
    """
    Read-only Vehicle queries.
    """

    @staticmethod
    def list_vehicles():
        return (
            Vehicle.objects
            .select_related(
                "city",
                "route",
                "driver",
            )
            .all()
            .order_by(
                "vehicle_number"
            )
        )

    @staticmethod
    def get_vehicle(
        vehicle_id,
    ):
        return (
            Vehicle.objects
            .select_related(
                "city",
                "route",
                "driver",
                "state",
            )
            .get(
                id=vehicle_id
            )
        )

    @staticmethod
    def get_vehicle_by_number(
        vehicle_number,
    ):
        return (
            Vehicle.objects
            .select_related(
                "city",
                "route",
                "driver",
                "state",
            )
            .get(
                vehicle_number=vehicle_number
            )
        )

    @staticmethod
    def list_city_vehicles(
        city_id,
    ):
        return (
            Vehicle.objects
            .select_related(
                "city",
                "route",
                "driver",
            )
            .filter(
                city_id=city_id
            )
            .order_by(
                "vehicle_number"
            )
        )

    @staticmethod
    def list_route_vehicles(
        route_id,
    ):
        return (
            Vehicle.objects
            .select_related(
                "city",
                "route",
                "driver",
            )
            .filter(
                route_id=route_id
            )
        )

    @staticmethod
    def get_driver_vehicle(
        driver_id,
    ):
        return (
            Vehicle.objects
            .select_related(
                "city",
                "route",
                "driver",
                "state",
            )
            .filter(
                driver_id=driver_id
            )
            .first()
        )

    @staticmethod
    def active_vehicles():
        return (
            Vehicle.objects
            .select_related(
                "city",
                "route",
                "driver",
            )
            .filter(
                is_active=True
            )
        )