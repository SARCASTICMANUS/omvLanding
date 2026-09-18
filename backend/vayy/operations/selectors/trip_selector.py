from operations.models import (
    ActiveTrip,
)

from common.constants import (
    TRIP_STATUS_ACTIVE,
)


class TripSelector:
    """
    Read-only ActiveTrip queries.
    """

    @staticmethod
    def list_active_trips():
        return (
            ActiveTrip.objects
            .select_related(
                "vehicle",
                "route",
                "driver",
                "trip_schedule",
            )
            .filter(
                status=TRIP_STATUS_ACTIVE
            )
            .order_by(
                "-started_at"
            )
        )

    @staticmethod
    def get_trip(
        trip_id,
    ):
        return (
            ActiveTrip.objects
            .select_related(
                "vehicle",
                "route",
                "driver",
                "trip_schedule",
            )
            .prefetch_related(
                "boarding_requests",
            )
            .get(
                id=trip_id
            )
        )

    @staticmethod
    def get_active_trip(
        trip_id,
    ):
        return (
            ActiveTrip.objects
            .select_related(
                "vehicle",
                "route",
                "driver",
                "trip_schedule",
            )
            .get(
                id=trip_id,
                status=TRIP_STATUS_ACTIVE,
            )
        )

    @staticmethod
    def get_vehicle_active_trip(
        vehicle_id,
    ):
        return (
            ActiveTrip.objects
            .select_related(
                "vehicle",
                "route",
                "driver",
                "trip_schedule",
            )
            .filter(
                vehicle_id=vehicle_id,
                status=TRIP_STATUS_ACTIVE,
            )
            .first()
        )

    @staticmethod
    def get_driver_active_trip(
        driver_id,
    ):
        return (
            ActiveTrip.objects
            .select_related(
                "vehicle",
                "route",
                "driver",
                "trip_schedule",
            )
            .filter(
                driver_id=driver_id,
                status=TRIP_STATUS_ACTIVE,
            )
            .first()
        )

    @staticmethod
    def list_driver_trips(
        driver_id,
    ):
        return (
            ActiveTrip.objects
            .select_related(
                "vehicle",
                "route",
                "trip_schedule",
            )
            .filter(
                driver_id=driver_id
            )
            .order_by(
                "-started_at"
            )
        )

    @staticmethod
    def list_route_trips(
        route_id,
    ):
        return (
            ActiveTrip.objects
            .select_related(
                "vehicle",
                "route",
                "driver",
            )
            .filter(
                route_id=route_id
            )
            .order_by(
                "-started_at"
            )
        )

    @staticmethod
    def list_city_active_trips(
        city_id,
    ):
        return (
            ActiveTrip.objects
            .select_related(
                "vehicle",
                "route",
                "driver",
                "trip_schedule",
            )
            .filter(
                vehicle__city_id=city_id,
                status=TRIP_STATUS_ACTIVE,
            )
        )