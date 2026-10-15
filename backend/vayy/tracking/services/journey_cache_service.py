import json
import logging
from typing import Any, Dict, List, Optional, Tuple

from django.core.cache import cache

from common.constants import JOURNEY_PATH_TTL_SECONDS

logger = logging.getLogger(__name__)

# Redis key names
PATH_PREFIX = "vayy:journey:path"
ORDERED_STOPS_PREFIX = "vayy:journey:ordered_stops"
PASSING_TRIPS_PREFIX = "vayy:stop:passing_trips"
ACTIVE_JOURNEYS_KEY = "vayy:journey:active"


class JourneyCacheService:
    """
    Redis-backed store for live driver journeys.

    A journey is one direct OSRM path from the driver's declared origin to
    destination, plus the admin-managed global stops that fall inside the
    corridor around that path, ordered nearest-first from the origin.

    Why Redis and not the trip row: the polyline is thousands of points, changes
    once at the start of the trip and is worthless the moment it ends, and the
    whole passenger-facing question ("which vehicles pass this stop?") is
    answered by a set lookup per stop rather than a spatial query per request.
    The durable facts of the journey (who, when, how far, what fare) stay on
    ``ActiveTrip``.

    Three keys, all TTL'd as a crash safety net; ``delete_journey`` is the
    normal path out and is called on trip end:

    * ``vayy:journey:path:{trip_id}``            -> path + metrics document
    * ``vayy:journey:ordered_stops:{trip_id}``   -> ordered stop entries
    * ``vayy:stop:passing_trips:{stop_id}``      -> trips whose path serves it
    """

    @staticmethod
    def _decode(val):
        return val.decode() if isinstance(val, bytes) else val

    @staticmethod
    def path_key(trip_id: str) -> str:
        return f"{PATH_PREFIX}:{trip_id}"

    @staticmethod
    def ordered_stops_key(trip_id: str) -> str:
        return f"{ORDERED_STOPS_PREFIX}:{trip_id}"

    @staticmethod
    def passing_trips_key(stop_id: str) -> str:
        return f"{PASSING_TRIPS_PREFIX}:{stop_id}"

    # ── write path ─────────────────────────────────────────────

    @classmethod
    def save_journey(
        cls,
        trip_id: str,
        path_coords: List[List[float]],
        distance_m: float,
        duration_s: float,
        origin: Tuple[float, float],
        destination: Tuple[float, float],
        ordered_stops: List[Dict[str, Any]],
    ) -> bool:
        """
        Store the path document, the ordered stops, and the reverse stop -> trip
        index in one go.

        ``path_coords`` is ``[[lat, lng], ...]``. Returns False if the write
        failed, which the caller must treat as "journey did not start" — a
        journey whose path is not cached cannot be snapped, matched or cleaned
        up, so half-writing it would leave a live trip nobody can serve.
        """
        try:
            client = cache.client.get_client()
            ttl = JOURNEY_PATH_TTL_SECONDS

            document = {
                "trip_id": str(trip_id),
                "path": path_coords,
                "distance_m": float(distance_m),
                "duration_s": float(duration_s),
                "origin": {"lat": origin[0], "lng": origin[1]},
                "destination": {"lat": destination[0], "lng": destination[1]},
                "stop_count": len(ordered_stops),
            }

            pipe = client.pipeline()
            pipe.set(cls.path_key(trip_id), json.dumps(document), ex=ttl)
            pipe.set(
                cls.ordered_stops_key(trip_id),
                json.dumps(ordered_stops),
                ex=ttl,
            )
            pipe.sadd(ACTIVE_JOURNEYS_KEY, str(trip_id))
            for stop in ordered_stops:
                key = cls.passing_trips_key(stop["stop_id"])
                pipe.sadd(key, str(trip_id))
                pipe.expire(key, ttl)
            pipe.execute()

            logger.info(
                "Journey cache saved: trip=%s stops=%d points=%d",
                trip_id,
                len(ordered_stops),
                len(path_coords),
            )
            return True
        except Exception as exc:
            logger.exception("Journey cache write failed for trip %s: %s", trip_id, exc)
            return False

    # ── read path ──────────────────────────────────────────────

    @classmethod
    def get_active_trip_ids(cls) -> List[str]:
        """Redis index of currently discoverable free-form journeys."""
        try:
            client = cache.client.get_client()
            active_ids = [cls._decode(value) for value in client.smembers(ACTIVE_JOURNEYS_KEY) or []]
            if active_ids:
                return active_ids
            # One-time recovery for journeys that were already active before
            # this Redis index was introduced (or after an index-only flush).
            from operations.models import ActiveTrip
            from common.constants import TRIP_STATUS_ACTIVE
            active_ids = [str(value) for value in ActiveTrip.objects.filter(
                status=TRIP_STATUS_ACTIVE, route__isnull=True
            ).values_list("id", flat=True)]
            if active_ids:
                client.sadd(ACTIVE_JOURNEYS_KEY, *active_ids)
            return active_ids
        except Exception as exc:
            logger.warning("Active journey index read failed: %s", exc)
            return []

    @classmethod
    def get_journey(cls, trip_id: str) -> Optional[Dict[str, Any]]:
        """The full path document, or None if this journey is not cached."""
        try:
            client = cache.client.get_client()
            raw = client.get(cls.path_key(trip_id))
            if not raw:
                return None
            return json.loads(cls._decode(raw))
        except Exception as exc:
            logger.warning("Journey cache read failed for trip %s: %s", trip_id, exc)
            return None

    @classmethod
    def get_path(cls, trip_id: str) -> List[List[float]]:
        """``[[lat, lng], ...]`` for the journey path; empty when absent."""
        journey = cls.get_journey(trip_id)
        return journey.get("path") if journey else []

    @classmethod
    def get_ordered_stops(cls, trip_id: str) -> List[Dict[str, Any]]:
        """
        The stops on this journey, nearest-first from the origin.

        Each entry carries ``stop_id``, ``dist_along_m`` (distance from the
        origin along the path) and the stop's coordinates, which lets callers
        answer "am I past this stop yet?" without touching the database.
        """
        try:
            client = cache.client.get_client()
            raw = client.get(cls.ordered_stops_key(trip_id))
            if not raw:
                return []
            return json.loads(cls._decode(raw))
        except Exception as exc:
            logger.warning(
                "Journey ordered stops read failed for trip %s: %s", trip_id, exc
            )
            return []

    @classmethod
    def get_stop_entries(cls, trip_id: str, stop_id: str) -> List[Dict[str, Any]]:
        """The ordered-stop entry for one stop on this journey, if it is served."""
        for entry in cls.get_ordered_stops(trip_id):
            if str(entry.get("stop_id")) == str(stop_id):
                return [entry]
        return []

    @classmethod
    def get_passing_trips(cls, stop_id: str) -> List[str]:
        """Trip ids whose path serves this stop."""
        try:
            client = cache.client.get_client()
            members = client.smembers(cls.passing_trips_key(stop_id))
            return [cls._decode(m) for m in members or []]
        except Exception as exc:
            logger.warning(
                "Journey passing trips read failed for stop %s: %s", stop_id, exc
            )
            return []

    @classmethod
    def journey_serves_stop(cls, trip_id: str, stop_id: str) -> bool:
        """True when this journey's path passes the given stop."""
        return bool(cls.get_stop_entries(trip_id, stop_id))

    @classmethod
    def refresh_ttl(cls, trip_id: str) -> None:
        """
        Push the expiry out on a live journey.

        A journey can legitimately outlast the initial TTL, and losing its path
        mid-trip would strand it. Called on every accepted boarding so an
        actively-used journey keeps its documents.
        """
        try:
            client = cache.client.get_client()
            ttl = JOURNEY_PATH_TTL_SECONDS
            pipe = client.pipeline()
            pipe.expire(cls.path_key(trip_id), ttl)
            pipe.expire(cls.ordered_stops_key(trip_id), ttl)
            for stop in cls.get_ordered_stops(trip_id):
                pipe.expire(cls.passing_trips_key(stop["stop_id"]), ttl)
            pipe.execute()
        except Exception as exc:
            logger.warning("Journey TTL refresh failed for trip %s: %s", trip_id, exc)

    # ── delete path ────────────────────────────────────────────

    @classmethod
    def delete_journey(cls, trip_id: str) -> bool:
        """
        Remove every trace of a journey: its path, its ordered stops, and its
        membership in each stop's passing-trip set.

        The reverse index is cleaned through the ordered-stop list, which is why
        it is written rather than derived — without it, trips would linger in
        ``passing_trips`` until the TTL expired and a finished vehicle would
        keep showing up as passing a stop.
        """
        try:
            client = cache.client.get_client()
            pipe = client.pipeline()
            for stop in cls.get_ordered_stops(trip_id):
                pipe.srem(cls.passing_trips_key(stop["stop_id"]), str(trip_id))
            pipe.srem(ACTIVE_JOURNEYS_KEY, str(trip_id))
            pipe.delete(cls.path_key(trip_id))
            pipe.delete(cls.ordered_stops_key(trip_id))
            pipe.execute()
            logger.info("Journey cache deleted for trip %s", trip_id)
            return True
        except Exception as exc:
            logger.exception(
                "Journey cache delete failed for trip %s: %s", trip_id, exc
            )
            return False
