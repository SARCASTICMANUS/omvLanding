from transport.models import Route


class DriverRouteSelector:
    """
    Read-only Route queries for driver route listing.
    """

    @staticmethod
    def list_driver_routes():
        return (
            Route.objects
            .select_related("city")
            .prefetch_related("stops", "schedules", "schedules__stop_times")
            .filter(is_public=True)
            .order_by("name")
        )
