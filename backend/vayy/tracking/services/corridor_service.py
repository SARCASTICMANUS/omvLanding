import logging
import math
from typing import Any, Dict, List, Optional, Tuple

from django.contrib.gis.db.models.functions import Distance
from django.contrib.gis.geos import LineString, Point
from django.contrib.gis.measure import D

from common.constants import JOURNEY_CORRIDOR_RADIUS_M
from tracking.services.journey_cache_service import JourneyCacheService

logger = logging.getLogger(__name__)


class CorridorService:
    """
    Matches a driver's free-form journey path against admin-managed global stops.

    A journey is one OSRM path from origin to destination. A stop is "on the
    way" when it sits within ``JOURNEY_CORRIDOR_RADIUS_M`` of that path, and its
    position along the journey is the distance from the origin to its projection
    on the path. Ordering stops by that distance is what makes "nearest-first"
    meaningful: it is the order the driver will actually reach them, which is
    also the order passengers experience.

    Nothing here re-routes the driver through a stop. The path stays the direct
    road route the driver asked for; stops are attached to it, not imposed on
    it.
    """

    # ── geometry ───────────────────────────────────────────────

    @staticmethod
    def _haversine_m(p1: Tuple[float, float], p2: Tuple[float, float]) -> float:
        lon1, lat1 = math.radians(p1[0]), math.radians(p1[1])
        lon2, lat2 = math.radians(p2[0]), math.radians(p2[1])
        dlat = lat2 - lat1
        dlon = lon2 - lon1
        a = (
            math.sin(dlat / 2) ** 2
            + math.cos(lat1) * math.cos(lat2) * math.sin(dlon / 2) ** 2
        )
        return 2 * 6371000 * math.asin(math.sqrt(a))

    @classmethod
    def _project(cls, point: Tuple[float, float], coords: List[Tuple[float, float]]):
        """
        Project (lng, lat) onto a polyline.

        Returns (segment_index, fraction, distance_to_path_m, distance_along_m).
        Local projection math rather than PostGIS: the candidate set is already
        filtered by an indexed distance query, so this only has to order the
        handful of stops that survived.
        """
        best_dist = float("inf")
        best_seg = 0
        best_frac = 0.0
        best_cumul = 0.0
        cumul_before = 0.0

        for i in range(len(coords) - 1):
            seg_len = cls._haversine_m(coords[i], coords[i + 1])
            if seg_len < 1e-9:
                cumul_before += seg_len
                continue

            ax, ay = coords[i]
            bx, by = coords[i + 1]
            px, py = point

            abx = (bx - ax) * math.cos(math.radians((ay + by) / 2)) * 111320
            aby = (by - ay) * 110540
            apx = (px - ax) * math.cos(math.radians((ay + py) / 2)) * 111320
            apy = (py - ay) * 110540

            dot = apx * abx + apy * aby
            t = max(0.0, min(1.0, dot / (abx * abx + aby * aby + 1e-12)))

            proj = (ax + t * (bx - ax), ay + t * (by - ay))
            dist = cls._haversine_m(point, proj)

            if dist < best_dist:
                best_dist = dist
                best_seg = i
                best_frac = t
                best_cumul = cumul_before + t * seg_len

            cumul_before += seg_len

        return best_seg, best_frac, best_dist, best_cumul

    # ── stop discovery ─────────────────────────────────────────

    @classmethod
    def stops_within_corridor(
        cls,
        path_coords: List[Tuple[float, float]],
        radius_m: int = JOURNEY_CORRIDOR_RADIUS_M,
        stop_ids: Optional[List[str]] = None,
    ) -> List[Any]:
        """
        Global stops within ``radius_m`` of the path, unsorted.

        The spatial filter runs in PostGIS (``dwithin`` against the path
        LineString) so it uses the location index instead of loading every stop
        in the city. ``stop_ids`` narrows the scan to a caller-provided set.
        """
        from transport.models import Stop

        if len(path_coords) < 2:
            return []

        try:
            line = LineString(path_coords, srid=4326)
        except Exception as exc:
            logger.warning("Corridor: could not build path geometry: %s", exc)
            return []

        queryset = Stop.objects.filter(
            is_global=True,
            location__isnull=False,
            location__dwithin=(line, D(m=radius_m)),
        ).annotate(
            distance_to_path_m=Distance("location", line),
        )

        if stop_ids is not None:
            queryset = queryset.filter(id__in=stop_ids)

        return list(queryset)

    @classmethod
    def order_stops_along_path(
        cls,
        stops: List[Any],
        path_coords: List[Tuple[float, float]],
    ) -> List[Dict[str, Any]]:
        """
        Order stops by distance along the path, nearest-first from the origin.

        Each entry is what the journey cache stores and every consumer reads:

        ``stop_id``, ``dist_along_m`` (where on the journey it falls),
        ``corridor_distance_m`` (how far off the path it sits),
        ``lat``/``lng``/``name``.
        """
        entries = []
        for stop in stops:
            lng, lat = stop.location.x, stop.location.y
            seg, _frac, dist_to_path, dist_along = cls._project(
                (lng, lat), path_coords
            )
            entries.append(
                {
                    "stop_id": str(stop.id),
                    "name": stop.name,
                    # Additive: helps the driver recognise a stop in the preview
                    # list, where a name alone is often ambiguous.
                    "nearby_landmark": stop.nearby_landmark or "",
                    "lat": lat,
                    "lng": lng,
                    "dist_along_m": round(dist_along, 1),
                    "corridor_distance_m": round(dist_to_path, 1),
                    "segment_index": seg,
                }
            )

        entries.sort(key=lambda e: e["dist_along_m"])
        return entries

    @classmethod
    def stops_on_path(
        cls,
        path_coords: List[Tuple[float, float]],
        radius_m: int = JOURNEY_CORRIDOR_RADIUS_M,
        stop_ids: Optional[List[str]] = None,
    ) -> List[Dict[str, Any]]:
        """Discover global stops near the path and return them nearest-first."""
        stops = cls.stops_within_corridor(path_coords, radius_m, stop_ids)
        return cls.order_stops_along_path(stops, path_coords)

    # ── journey progress ───────────────────────────────────────

    @classmethod
    def progress_m(
        cls,
        trip_id: str,
        location: Optional[Tuple[float, float]] = None,
        path_coords: Optional[List[List[float]]] = None,
    ) -> Optional[float]:
        """
        Distance travelled along the journey path, in metres.

        Returns None when the journey path is not cached, so callers can tell
        "no progress yet" apart from "started at the origin".
        """
        if path_coords is None:
            journey = JourneyCacheService.get_journey(trip_id)
            if not journey:
                return None
            path_coords = journey.get("path") or []

        if not path_coords or len(path_coords) < 2:
            return None

        if location is None:
            return None

        lng_lat = [(c[1], c[0]) for c in path_coords]  # stored lat,lng -> lng,lat
        _seg, _frac, _dist, dist_along = cls._project(location, lng_lat)
        return dist_along

    @classmethod
    def remaining_distance_m(
        cls,
        trip_id: str,
        progress: float,
    ) -> Optional[float]:
        """Distance left on the journey, given the distance already travelled."""
        journey = JourneyCacheService.get_journey(trip_id)
        if not journey:
            return None
        total = float(journey.get("distance_m") or 0)
        if not total:
            return None
        return max(0.0, total - float(progress or 0))

    @classmethod
    def is_stop_ahead(
        cls,
        trip_id: str,
        stop_id: str,
        progress_m: Optional[float] = None,
    ) -> bool:
        """
        True when the driver has not yet reached this stop on the journey.

        A driver who has already passed a stop cannot serve a hand raised there,
        which is what keeps the passenger-facing list of vehicles meaningful.
        """
        entries = JourneyCacheService.get_stop_entries(trip_id, stop_id)
        if not entries:
            return False
        if progress_m is None:
            # Without progress we cannot prove it was passed, so treat it as
            # ahead rather than silently dropping a driver who is on time.
            return True
        return float(entries[0].get("dist_along_m") or 0) >= float(progress_m)

    @classmethod
    def is_drop_after_pickup(
        cls,
        trip_id: str,
        pickup_stop_id: str,
        drop_stop_id: Optional[str],
    ) -> bool:
        """
        True when the drop stop comes after the pickup stop on this journey.

        The ordering is the point of the whole check: a passenger must not be
        promised a ride "on the way" to somewhere the vehicle has already
        committed to passing before it reaches them.
        """
        if not drop_stop_id:
            return True
        if str(drop_stop_id) == str(pickup_stop_id):
            return False

        entries = JourneyCacheService.get_ordered_stops(trip_id)
        pickup_index = None
        drop_index = None
        for idx, entry in enumerate(entries):
            if str(entry.get("stop_id")) == str(pickup_stop_id):
                pickup_index = idx
            if str(entry.get("stop_id")) == str(drop_stop_id):
                drop_index = idx

        if pickup_index is None or drop_index is None:
            # Not both on this journey: the caller decides whether that is
            # fatal. Report it as not-ordered rather than asserting a trip.
            return False
        return drop_index > pickup_index

    @classmethod
    def eta_to_stop_s(
        cls,
        trip_id: str,
        stop_id: str,
        average_speed_kmph: float = 30.0,
    ) -> Optional[int]:
        """
        Rough seconds until the vehicle reaches a stop on this journey.

        Derived from the remaining path distance at the city-average speed used
        elsewhere in dispatch, so it is an estimate consistent with the numbers
        the driver already sees.
        """
        journey = JourneyCacheService.get_journey(trip_id)
        if not journey:
            return None
        entries = JourneyCacheService.get_stop_entries(trip_id, stop_id)
        if not entries:
            return None

        total = float(journey.get("distance_m") or 0)
        dist_along = float(entries[0].get("dist_along_m") or 0)
        remaining = max(0.0, total - dist_along)
        if average_speed_kmph <= 0:
            return None
        return int(round((remaining / 1000.0) / average_speed_kmph * 3600))
