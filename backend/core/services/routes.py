from django.contrib.gis.geos import LineString, Point
from django.contrib.gis.db.models.functions import Distance
from django.db.models import Count

from core.models import BoardingRequest, Route, Stop
from core.services.redis_service import get_redis_client
from core.utils import create_route_geometry


def _to_float(value):
    return float(value)


def _same_point(left, right, tolerance=0.00001):
    return (
        left
        and right
        and abs(_to_float(left["lat"]) - _to_float(right["lat"])) <= tolerance
        and abs(_to_float(left["lon"]) - _to_float(right["lon"])) <= tolerance
    )


def _normalize_path_coord(coord):
    first = _to_float(coord[0])
    second = _to_float(coord[1])
    if abs(first) > 35 or abs(second) <= 35:
        return first, second
    return second, first


def normalize_route_points(start, end, stops_data):
    """
    Return all route stops in order and waypoints without duplicating endpoints.
    The API remains backward compatible with old clients that sent only
    intermediate stops, while new clients can mark start/end as selected stops.
    """
    ordered_stops = sorted(stops_data or [], key=lambda s: s.get("order", 0))
    all_stops = list(ordered_stops)

    if start and not any(_same_point(start, stop) for stop in all_stops):
        all_stops.insert(
            0,
            {
                "name": start.get("name") or "Start",
                "lat": start["lat"],
                "lon": start["lon"],
                "order": -1,
                "is_start": True,
            },
        )

    if end and not any(_same_point(end, stop) for stop in all_stops):
        all_stops.append(
            {
                "name": end.get("name") or "End",
                "lat": end["lat"],
                "lon": end["lon"],
                "order": len(all_stops),
                "is_end": True,
            }
        )

    waypoints = [
        (_to_float(stop["lon"]), _to_float(stop["lat"])) for stop in all_stops
    ]
    return all_stops, waypoints


def build_route_geometry(start, end, stops_data, custom_geometry=None, total_distance=0):
    if custom_geometry:
        return LineString([_normalize_path_coord(coord) for coord in custom_geometry], srid=4326), total_distance

    _, waypoints = normalize_route_points(start, end, stops_data)
    route_data = create_route_geometry(waypoints)
    if route_data is None:
        return None, None
    return route_data["geometry"], route_data["total_distance"]


def create_route_from_payload(payload):
    start = payload.get("start")
    end = payload.get("end")
    stops_data = payload.get("stops", [])
    all_stops, waypoints = normalize_route_points(start, end, stops_data)

    custom_geometry = payload.get("path")
    if custom_geometry:
        path = LineString(
            [_normalize_path_coord(coord) for coord in custom_geometry], srid=4326
        )
        total_distance = payload.get("total_distance", 0)
    else:
        route_data = create_route_geometry(waypoints)
        if route_data is None:
            return None
        path = route_data["geometry"]
        total_distance = route_data["total_distance"]

    route = Route.objects.create(
        city_id=payload.get("city") or payload.get("city_id") or None,
        path=path,
        total_distance_meters=total_distance,
        start_name=payload.get("start_name") or all_stops[0].get("name", "Start"),
        end_name=payload.get("end_name") or all_stops[-1].get("name", "End"),
        name=payload.get("name", "New Route"),
        bus_number=payload.get("bus_number", ""),
        is_public=payload.get("is_public", True),
    )

    for idx, stop in enumerate(all_stops):
        Stop.objects.create(
            route=route,
            name=stop.get("name", f"Stop {idx + 1}"),
            location=Point(_to_float(stop["lon"]), _to_float(stop["lat"]), srid=4326),
            order=idx,
        )

    return route


def get_trip_progress_order(trip):
    try:
        cached_order = get_redis_client().get(f"driver_last_stop:{trip.id}")
        if cached_order is not None:
            return int(cached_order)
    except Exception:
        pass

    if not trip.current_location:
        return -1

    nearest = (
        trip.route.stops.annotate(distance=Distance("location", trip.current_location))
        .order_by("distance")
        .first()
    )
    if nearest:
        return nearest.order
    return -1


def get_next_stops_for_trip(trip, limit=3):
    current_order = get_trip_progress_order(trip)
    stops = list(
        trip.route.stops.filter(order__gt=current_order)
        .order_by("order")
        .prefetch_related("boarding_requests")[:limit]
    )

    if not stops:
        stops = list(trip.route.stops.order_by("order")[:limit])

    counts = {
        item["pickup_stop_id"]: item["count"]
        for item in BoardingRequest.objects.filter(
            trip=trip,
            pickup_stop__in=stops,
            status__in=["pending", "approaching"],
        )
        .values("pickup_stop_id")
        .annotate(count=Count("id"))
    }

    return [
        {
            "stop_id": str(stop.id),
            "id": str(stop.id),
            "name": stop.name,
            "lat": stop.location.y,
            "lon": stop.location.x,
            "order": stop.order,
            "waiting_count": counts.get(stop.id, 0),
        }
        for stop in stops
    ]
