from django.contrib.gis.geos import Point
from django.contrib.gis.measure import D

from transport.models import (
    Route,
    Stop,
)


class RouteSelector:
    """
    Read-only Route queries.
    """

    @staticmethod
    def list_routes():
        return (
            Route.objects
            .select_related("city")
            .all()
            .order_by("name")
        )

    @staticmethod
    def list_city_routes(city_id):
        return (
            Route.objects
            .select_related("city")
            .filter(city_id=city_id)
            .order_by("name")
        )

    @staticmethod
    def get_route(route_id):
        return (
            Route.objects
            .select_related("city")
            .prefetch_related(
                "stops",
                "schedules",
                "schedules__stop_times",
                "schedules__stop_times__stop",
            )
            .get(id=route_id)
        )

    @staticmethod
    def get_route_by_bus_number(
        bus_number,
    ):
        return (
            Route.objects
            .select_related("city")
            .get(bus_number=bus_number)
        )

    @staticmethod
    def search_routes(query):
        return (
            Route.objects
            .select_related("city")
            .filter(name__icontains=query)
            .order_by("name")
        )

    @staticmethod
    def search_routes_by_location(origin_lat, origin_lng, dest_lat, dest_lng, radius=5000):
        """
        Find routes that have stops near both the origin and destination points.
        """
        origin_point = Point(origin_lng, origin_lat, srid=4326)
        dest_point = Point(dest_lng, dest_lat, srid=4326)

        origin_route_ids = (
            Stop.objects
            .filter(location__distance_lte=(origin_point, D(m=radius)))
            .values_list("route_id", flat=True)
            .distinct()
        )

        dest_route_ids = (
            Stop.objects
            .filter(location__distance_lte=(dest_point, D(m=radius)))
            .values_list("route_id", flat=True)
            .distinct()
        )

        route_ids = set(origin_route_ids) & set(dest_route_ids)

        return (
            Route.objects
            .select_related("city")
            .prefetch_related("stops")
            .filter(id__in=route_ids, is_public=True)
            .order_by("name")
        )