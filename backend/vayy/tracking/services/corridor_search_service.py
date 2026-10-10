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
        """
        Vehicles running the corridor between two points.

        ``origin``/``destination`` are ``(lat, lng)``.

        Returns ``{"path", "stops", "vehicles", ...}``. A vehicle is ranked by
        how far along the corridor its boarding stop is - the nearest boardable
        point to where the passenger set off - with ETA as the tiebreak, because
        "who can I get onto soonest" is what the search is for.
        """
        from operations.services.journey_service import JourneyService

        path_result = JourneyService._build_path(origin, destination)
        if not path_result:
            return {
                "path": [],
                "stops": [],
                "vehicles": [],
                "distance_m": None,
                "duration_s": None,
                "resolved": False,
            }

        coords_latlng, distance_m, duration_s = path_result
        coords_lnglat = [(c[1], c[0]) for c in coords_latlng]
        stops = CorridorService.stops_on_path(coords_lnglat, radius_m=radius_m)

        # One pass per stop, but a vehicle serving several stops on the same
        # journey must appear once - at the earliest stop the passenger could
        # board it, which is the best of its positions along the corridor.
        best_by_trip = {}
        for stop in stops:
            for row in CorridorSearchService._vehicle_rows_for_stop(stop["stop_id"]):
                existing = best_by_trip.get(row["trip_id"])
                if existing is None:
                    best_by_trip[row["trip_id"]] = row
                else:
                    new_along = row["board_stop"]["dist_along_m"] or 0
                    old_along = existing["board_stop"]["dist_along_m"] or 0
                    if new_along < old_along:
                        best_by_trip[row["trip_id"]] = row

        vehicles = sorted(
            best_by_trip.values(),
            key=lambda r: (
                r["board_stop"]["dist_along_m"] if r["board_stop"]["dist_along_m"] is not None else 1e12,
                r["eta_minutes"] if r["eta_minutes"] is not None else 1e12,
            ),
        )[:limit]

        return {
            "path": coords_latlng,
            "distance_m": round(distance_m, 1),
            "duration_s": round(duration_s, 1),
            "origin": {"lat": origin[0], "lng": origin[1]},
            "destination": {"lat": destination[0], "lng": destination[1]},
            "stops": stops,
            # Stops a passenger can actually walk to from where they searched.
            # The full corridor can run for kilometres; this is the walkable
            # slice, so the card can offer somewhere to stand without the rider
            # being told to walk half the route.
            "nearby_stops": _nearby_stops(stops, origin),
            "vehicles": vehicles,
            "resolved": True,
        }


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
