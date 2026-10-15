"""
Passenger-facing search for live vehicles along a searched route.

Answers the question the trip planner asks: "I want to go from A to B - which
vehicles are running that right now?" It resolves the road between the two
points, finds the global stops inside that corridor, and returns the vehicles
whose current journey serves those stops and has not passed them yet.

Built on the same pieces the single-stop view already uses
(``CorridorService`` for the corridor, ``JourneyCacheService`` for the Redis
path/stop documents), so results here and results on the stop board cannot
disagree about which vehicles serve a stop.
"""

import hashlib
import json
import time
from django.core.cache import cache
from geopy.distance import distance as geopy_distance

from tracking.services.corridor_service import CorridorService
from tracking.services.journey_cache_service import JourneyCacheService

from common.constants import JOURNEY_CORRIDOR_RADIUS_M, TRIP_STATUS_ACTIVE


class CorridorSearchService:
    """
    Live vehicles serving a searched origin -> destination corridor.
    """

    @staticmethod
    def _vehicle_rows_for_stop(stop_id: str) -> list:
        """
        Vehicles whose live journey serves ``stop_id`` and can still pick up.

        Mirrors the per-stop answer exactly (``find_candidates_for_stop`` plus the
        corridor ETA) so the two views agree. Returns raw dicts; the caller
        ranks them across the whole corridor.
        """
        from operations.models import ActiveTrip

        trip_ids = JourneyCacheService.get_passing_trips(stop_id)
        if not trip_ids:
            return []

        stop = _stop_model().objects.filter(id=stop_id).first()
        if stop is None or stop.location is None:
            return []

        trips = (
            ActiveTrip.objects.filter(
                id__in=trip_ids,
                status=TRIP_STATUS_ACTIVE,
                route__isnull=True,
            )
            .select_related("vehicle", "vehicle__driver", "vehicle__city")
            .prefetch_related("vehicle__state")
        )

        rows = []
        stop_point = stop.location
        for trip in trips:
            # A driver who has already gone past this stop cannot serve a hand
            # raised here, so offering them would be a choice that cannot be
            # taken.
            if not CorridorService.is_stop_ahead(str(trip.id), str(stop_id)):
                continue

            state = getattr(trip.vehicle, "state", None)
            distance_km = None
            if state is not None and state.current_location:
                # Straight-line, matching how the accept path reports distance to
                # a passenger. The ETA beside it is road-derived, so the pair
                # reads consistently on the card.
                distance_km = round(
                    geopy_distance(
                        (state.current_location.y, state.current_location.x),
                        (stop_point.y, stop_point.x),
                    ).km,
                    2,
                )

            journey = JourneyCacheService.get_journey(str(trip.id)) or {}
            driver = trip.vehicle.driver

            rows.append(
                {
                    "trip_id": str(trip.id),
                    "vehicle_id": str(trip.vehicle.id),
                    "vehicle_number": trip.vehicle.vehicle_number,
                    "vehicle_type": trip.vehicle.vehicle_type,
                    "driver_id": str(driver.id) if driver else None,
                    # get_full_name() reads first/last name, which this User
                    # model does not define, so it is empty for every account.
                    # The driver profile's display_name is what the driver
                    # chose to be called and is what the accept path shows.
                    "driver_name": _driver_name(driver),
                    "driver_rating": _driver_rating(driver),
                    "board_stop": {
                        "id": str(stop.id),
                        "name": stop.name,
                        "nearby_landmark": stop.nearby_landmark or "",
                        "lat": stop.location.y,
                        "lng": stop.location.x,
                        "dist_along_m": _dist_along(str(trip.id), str(stop.id)),
                    },
                    "distance_km": distance_km,
                    # eta_to_stop_s returns SECONDS; this key is minutes, and
                    # the app renders it as "~N min". Converting here keeps the
                    # contract honest rather than showing 1058 minutes.
                    "eta_minutes": _eta_minutes(str(trip.id), str(stop_id)),
                    "lat": state.current_location.y if state and state.current_location else None,
                    "lng": state.current_location.x if state and state.current_location else None,
                    "destination": journey.get("destination"),
                    # The stops this vehicle still has to reach, in the order the
                    # driver meets them. The card shows these so a rider can see
                    # what lies between boarding and their destination.
                    "upcoming_stops": _upcoming_stops(str(trip.id), stop_id),
                }
            )
        return rows

    @staticmethod
    def find_vehicles(
        origin,
        destination,
        radius_m: int = JOURNEY_CORRIDOR_RADIUS_M,
        limit: int = 20,
    ) -> dict:
        """Return only live journeys whose actual road path contains both points.

        The former implementation matched any journey sharing a global stop
        with the passenger's independently routed corridor. That could show a
        driver who passed one point but could never serve the other. This path
        projects both passenger endpoints onto each driver's cached OSRM
        geometry and checks direction + current progress.
        """
        from operations.models import ActiveTrip
        from operations.services.journey_service import JourneyService
        from tracking.services.redis_geo_service import RedisGeoService

        # Cache only route geometry + global-stop indexing. Driver availability,
        # position, progress and ETA are recomputed from Redis on every refresh.
        cache_material = json.dumps([
            round(float(origin[0]), 5), round(float(origin[1]), 5),
            round(float(destination[0]), 5), round(float(destination[1]), 5),
            int(radius_m),
        ], separators=(",", ":"))
        cache_key = "vayy:corridor-search:" + hashlib.sha1(cache_material.encode()).hexdigest()
        cached_route = cache.get(cache_key)
        if cached_route:
            passenger_path = cached_route["path"]
            passenger_distance_m = cached_route["distance_m"]
            passenger_duration_s = cached_route["duration_s"]
        else:
            path_result = JourneyService._build_path(origin, destination)
            if not path_result:
                return {
                    "path": [], "stops": [], "nearby_stops": [], "vehicles": [],
                    "distance_m": None, "duration_s": None, "resolved": False,
                }
            passenger_path, passenger_distance_m, passenger_duration_s = path_result
            cache.set(cache_key, {
                "path": passenger_path,
                "distance_m": passenger_distance_m,
                "duration_s": passenger_duration_s,
            }, timeout=300)

        passenger_path_lnglat = [(point[1], point[0]) for point in passenger_path]
        match_tolerance_m = min(max(100, int(radius_m)), 500)
        # Global stops are intentionally read from the DB each refresh so an
        # admin upload/deactivation is reflected immediately, not after cache TTL.
        stops = CorridorService.stops_on_path(passenger_path_lnglat, radius_m=radius_m)
        active_trip_ids = JourneyCacheService.get_active_trip_ids()
        if not active_trip_ids:
            active_trips = []
        else:
            active_trips = (
                ActiveTrip.objects.filter(
                    id__in=active_trip_ids, status=TRIP_STATUS_ACTIVE, route__isnull=True
                )
                .select_related("vehicle", "vehicle__driver", "vehicle__city")
                .prefetch_related("vehicle__state")
            )

        vehicles = []
        for trip in active_trips:
            journey = JourneyCacheService.get_journey(str(trip.id))
            path = journey.get("path") if journey else None
            if not isinstance(path, list) or len(path) < 2:
                continue

            # Route coordinates are stored as [lat, lng]. Both points must be
            # close to the actual driver path, and pickup must be ahead of the
            # driver's current progress and before the destination.
            pickup_match = _project_point_to_path(origin, path)
            drop_match = _project_point_to_path(destination, path)
            if not pickup_match or not drop_match:
                continue
            if pickup_match["distance_m"] > match_tolerance_m or drop_match["distance_m"] > match_tolerance_m:
                continue
            if drop_match["along_m"] <= pickup_match["along_m"] + 30:
                continue

            snapshot = RedisGeoService.get_vehicle_snapshot(str(trip.vehicle_id)) or {}
            snapshot_ts = _as_float(snapshot.get("ts"))
            snapshot_age = (time.time() - snapshot_ts) if snapshot_ts else None
            # Do not surface a driver from an old DB location when the live
            # Redis heartbeat has expired. A stale marker is worse than no card.
            if snapshot_age is None or snapshot_age > 60:
                continue
            current_lat = _as_float(snapshot.get("lat"))
            current_lng = _as_float(snapshot.get("lng"))
            if current_lat is None or current_lng is None:
                continue

            current_match = _project_point_to_path((current_lat, current_lng), path)
            if not current_match or current_match["distance_m"] > match_tolerance_m:
                continue
            if current_match["along_m"] > pickup_match["along_m"] + 100:
                continue

            total_distance = float(journey.get("distance_m") or 0)
            total_duration = float(journey.get("duration_s") or 0)
            remaining_to_pickup_m = max(0, pickup_match["along_m"] - current_match["along_m"])
            segment_distance_m = max(0, drop_match["along_m"] - pickup_match["along_m"])
            route_speed_mps = total_distance / total_duration if total_distance > 0 and total_duration > 0 else 0
            live_speed_mps = _as_float(snapshot.get("speed")) or 0
            # Expo/browser GPS speed is metres per second. Ignore noisy near-zero
            # readings and fall back to OSRM's road-duration average.
            speed_mps = live_speed_mps if live_speed_mps > 2 else route_speed_mps
            eta_seconds = remaining_to_pickup_m / speed_mps if speed_mps > 0 else None
            segment_duration_s = segment_distance_m / route_speed_mps if route_speed_mps > 0 else None
            driver = trip.vehicle.driver
            if driver is None:
                continue

            pickup_stop = _nearest_stop_entry(str(trip.id), pickup_match["along_m"])
            dropoff_stop = _nearest_stop_entry(str(trip.id), drop_match["along_m"])
            # Hand-raise currently boards at admin-managed global stops. Keep
            # both points within a practical snap distance of those stops so the
            # card never offers a journey that the request API cannot accept.
            if not pickup_stop or not dropoff_stop:
                continue
            if abs(float(pickup_stop.get("dist_along_m") or 0) - pickup_match["along_m"]) > 1000:
                continue
            if abs(float(dropoff_stop.get("dist_along_m") or 0) - drop_match["along_m"]) > 1000:
                continue
            if float(pickup_stop.get("corridor_distance_m") or 0) > 500:
                continue
            if float(dropoff_stop.get("corridor_distance_m") or 0) > 500:
                continue
            if pickup_stop["id"] == dropoff_stop["id"] or float(dropoff_stop.get("dist_along_m") or 0) <= float(pickup_stop.get("dist_along_m") or 0):
                continue
            try:
                from operations.services.fare_service import FareService
                estimated_fare = FareService.calculate_fare(segment_distance_m / 1000.0, trip.vehicle.vehicle_type)
            except Exception:
                # Missing fare configuration must not break live discovery; the
                # client omits the estimate and never substitutes a fake amount.
                estimated_fare = None

            vehicles.append({
                "trip_id": str(trip.id),
                "vehicle_id": str(trip.vehicle_id),
                "vehicle_number": trip.vehicle.vehicle_number,
                "vehicle_type": trip.vehicle.vehicle_type,
                "driver_id": str(driver.id),
                "driver_name": _driver_name(driver),
                "driver_rating": _driver_rating(driver),
                "lat": current_lat,
                "lng": current_lng,
                "destination": journey.get("destination"),
                "pickup_match": {"distance_m": round(pickup_match["distance_m"], 1), "along_m": round(pickup_match["along_m"], 1)},
                "dropoff_match": {"distance_m": round(drop_match["distance_m"], 1), "along_m": round(drop_match["along_m"], 1)},
                "distance_to_pickup_m": round(remaining_to_pickup_m, 1),
                "eta_minutes": max(1, round(eta_seconds / 60)) if eta_seconds is not None else None,
                "segment_distance_m": round(segment_distance_m, 1),
                "segment_duration_s": round(segment_duration_s, 1) if segment_duration_s is not None else None,
                "estimated_fare": estimated_fare,
                "board_stop": pickup_stop,
                "drop_stop": dropoff_stop,
                "upcoming_stops": _upcoming_stops(str(trip.id), pickup_stop["id"] if pickup_stop else ""),
                "last_location_age_s": round(snapshot_age, 1) if snapshot_age is not None else None,
            })

        vehicles.sort(key=lambda row: (
            row["eta_minutes"] if row["eta_minutes"] is not None else 10**6,
            row["pickup_match"]["distance_m"],
        ))
        vehicles = vehicles[:max(1, min(int(limit), 50))]
        return {
            "path": passenger_path,
            "distance_m": round(passenger_distance_m, 1),
            "duration_s": round(passenger_duration_s, 1),
            "origin": {"lat": origin[0], "lng": origin[1]},
            "destination": {"lat": destination[0], "lng": destination[1]},
            "stops": stops,
            "nearby_stops": _nearby_stops(stops, origin),
            "vehicles": vehicles,
            "resolved": True,
        }


def _as_float(value):
    try:
        return float(value) if value not in (None, "") else None
    except (TypeError, ValueError):
        return None


def _project_point_to_path(point, path):
    """Return nearest route projection and distance along a [lat,lng] path."""
    from tracking.services.geo_service import GeoService
    if len(path) < 2:
        return None
    lat, lng = float(point[0]), float(point[1])
    cumulative = 0.0
    best = None
    for a, b in zip(path, path[1:]):
        a_lat, a_lng = float(a[0]), float(a[1])
        b_lat, b_lng = float(b[0]), float(b[1])
        mean_lat = (a_lat + b_lat + lat) / 3.0
        scale_x = 111320.0 * max(0.01, abs(__import__("math").cos(__import__("math").radians(mean_lat))))
        scale_y = 111320.0
        ax, ay = a_lng * scale_x, a_lat * scale_y
        bx, by = b_lng * scale_x, b_lat * scale_y
        px, py = lng * scale_x, lat * scale_y
        dx, dy = bx - ax, by - ay
        denom = dx * dx + dy * dy
        t = max(0.0, min(1.0, ((px - ax) * dx + (py - ay) * dy) / denom)) if denom else 0.0
        proj_lat = a_lat + (b_lat - a_lat) * t
        proj_lng = a_lng + (b_lng - a_lng) * t
        segment_m = GeoService.haversine_m(a_lat, a_lng, b_lat, b_lng)
        distance_m = GeoService.haversine_m(lat, lng, proj_lat, proj_lng)
        along_m = cumulative + segment_m * t
        if best is None or distance_m < best["distance_m"]:
            best = {"distance_m": distance_m, "along_m": along_m, "lat": proj_lat, "lng": proj_lng}
        cumulative += segment_m
    return best


def _nearest_stop_entry(trip_id, along_m):
    entries = JourneyCacheService.get_ordered_stops(trip_id)
    entries = [
        item for item in entries
        if float(item.get("corridor_distance_m") or 0) <= 500
        and abs(float(item.get("dist_along_m") or 0) - along_m) <= 1000
    ]
    if not entries:
        return None
    entry = min(entries, key=lambda item: abs(float(item.get("dist_along_m") or 0) - along_m))
    return {"id": str(entry.get("stop_id")), "name": entry.get("name"), "lat": entry.get("lat"), "lng": entry.get("lng"), "dist_along_m": entry.get("dist_along_m")}


def _nearest_stop_id(trip_id, along_m):
    entry = _nearest_stop_entry(trip_id, along_m)
    return entry.get("id") if entry else ""


def _stop_model():
    from transport.models import Stop

    return Stop


def _dist_along(trip_id: str, stop_id: str):
    entries = JourneyCacheService.get_stop_entries(trip_id, stop_id)
    if not entries:
        return None
    return entries[0].get("dist_along_m")


def _driver_rating(driver):
    profile = getattr(driver, "driver_profile", None)
    if profile is None or profile.rating is None:
        return None
    return float(profile.rating)

def _eta_minutes(trip_id: str, stop_id: str):
    """Whole minutes to a stop, or None when it cannot be estimated."""
    seconds = CorridorService.eta_to_stop_s(trip_id, stop_id)
    if seconds is None:
        return None
    return max(1, round(seconds / 60))


def _driver_name(driver) -> str:
    """A driver's name as other riders should see it."""
    if driver is None:
        return ""
    profile = getattr(driver, "driver_profile", None)
    if profile is not None and profile.display_name:
        return profile.display_name
    return driver.get_full_name() or driver.email


def _upcoming_stops(trip_id: str, board_stop_id: str, limit: int = 6):
    """
    The stops still ahead of the vehicle, nearest-first, with ETA.

    Read from the journey's cached stop list so this agrees with what the driver
    sees. A vehicle that has already passed a stop must not offer it.
    """
    entries = JourneyCacheService.get_ordered_stops(trip_id)
    if not entries:
        return []

    progress = CorridorService.progress_m(trip_id, _vehicle_pos(trip_id))
    board_along = next(
        (float(e.get("dist_along_m") or 0) for e in entries
         if str(e.get("stop_id")) == str(board_stop_id)),
        None,
    )

    out = []
    for entry in entries:
        along = float(entry.get("dist_along_m") or 0)
        if board_along is not None and along <= board_along:
            continue
        if progress is not None and along < progress:
            continue
        out.append(
            {
                "id": str(entry.get("stop_id")),
                "name": entry.get("name"),
                "nearby_landmark": entry.get("nearby_landmark") or "",
                "lat": entry.get("lat"),
                "lng": entry.get("lng"),
                "dist_along_m": entry.get("dist_along_m"),
            }
        )
        if len(out) >= limit:
            break
    return out


def _nearby_stops(stops, origin, radius_m: int = 1000, limit: int = 5):
    """
    Corridor stops within walking distance of the passenger's searched origin.

    Walking distance, not corridor distance: the whole point is somewhere the
    rider can reach on foot before the vehicle passes.
    """
    from geopy.distance import distance as geopy_distance

    here = (origin[0], origin[1])  # (lat, lng)
    out = []
    for stop in stops:
        if stop.get("lat") is None or stop.get("lng") is None:
            continue
        metres = geopy_distance(
            here, (float(stop["lat"]), float(stop["lng"]))
        ).m
        if metres > radius_m:
            continue
        out.append(
            {
                "id": str(stop.get("stop_id")),
                "name": stop.get("name"),
                "nearby_landmark": stop.get("nearby_landmark") or "",
                "lat": stop.get("lat"),
                "lng": stop.get("lng"),
                "dist_along_m": stop.get("dist_along_m"),
                "distance_m": round(metres, 1),
            }
        )
    out.sort(key=lambda s: s["distance_m"])
    return out[:limit]


def _vehicle_pos(trip_id: str):
    """The vehicle's last known (lng, lat), used to measure progress."""
    from operations.models import ActiveTrip

    trip = ActiveTrip.objects.filter(id=trip_id).select_related("vehicle__state").first()
    loc = getattr(getattr(trip, "vehicle", None), "current_location", None) if trip else None
    return (loc.x, loc.y) if loc is not None else None
