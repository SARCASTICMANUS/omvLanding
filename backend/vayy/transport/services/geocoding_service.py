import logging
import os
import re
from typing import Any, Dict, List, Optional, Tuple

from geopy.geocoders import Nominatim as GeopyNominatim
from geopy.location import Location
from geopy.exc import GeocoderTimedOut, GeocoderServiceError, GeocoderQueryError

from transport.models import Stop

logger = logging.getLogger(__name__)

_geolocator = GeopyNominatim(user_agent="vayy/1.0", timeout=10)

GEOCODE_CACHE_KEY_PREFIX = "geocode:search:v1"
GEOCODE_CACHE_TTL = 24 * 60 * 60  # 24h
GEOCODE_SEARCH_TIMEOUT = int(os.environ.get("GEOCODE_SEARCH_TIMEOUT", "3"))
GEOCODE_WARMUP_DELAY = 30


def normalize_query(query: str) -> str:
    if not query:
        return ""
    return re.sub(r"\s+", " ", query.strip().lower())[:100]


def build_search_cache_key(normalized_query: str, limit: int, country_codes: str) -> str:
    return f"{GEOCODE_CACHE_KEY_PREFIX}:{country_codes}:{limit}:{normalized_query}"


def _location_to_dict(loc: Location) -> Dict[str, Any]:
    raw = loc.raw
    return {
        "place_id": raw.get("place_id"),
        "licence": raw.get("licence", ""),
        "osm_type": raw.get("osm_type", ""),
        "osm_id": raw.get("osm_id", 0),
        "lat": str(loc.latitude),
        "lon": str(loc.longitude),
        "display_name": loc.address,
        "type": raw.get("type", ""),
        "class": raw.get("class", ""),
        "address": raw.get("address", {}),
    }


class GeocodingService:

    @classmethod
    def search_nominatim(
        cls,
        query: str,
        limit: int = 5,
        country_codes: str = "in",
        timeout: int = 10,
    ) -> Tuple[Optional[List[Dict[str, Any]]], bool]:
        """
        Raw external Nominatim call.

        Returns (results, ok):
        - (list, True)  - service answered (possibly empty result list)
        - (None, False) - service failed (timeout / service error / invalid query)
        """
        try:
            results = _geolocator.geocode(
                query,
                exactly_one=False,
                country_codes=country_codes,
                addressdetails=True,
                limit=limit,
                language="en",
                timeout=timeout,
            )
        except GeocoderTimedOut:
            logger.warning("Geocoding search timed out for query: %s", query)
            return None, False
        except GeocoderServiceError as exc:
            logger.error("Geocoding service error for query %s: %s", query, exc)
            return None, False
        except GeocoderQueryError as exc:
            logger.warning("Invalid geocoding query %s: %s", query, exc)
            return None, False

        if not results:
            return [], True

        if isinstance(results, Location):
            return [_location_to_dict(results)], True

        return [_location_to_dict(r) for r in results], True

    @classmethod
    def search(
        cls,
        query: str,
        limit: int = 5,
        country_codes: str = "in",
        timeout: int = 10,
    ) -> List[Dict[str, Any]]:
        results, _ok = cls.search_nominatim(
            query, limit=limit, country_codes=country_codes, timeout=timeout
        )
        return results if _ok else []

    @classmethod
    def search_db_stops(cls, query: str, limit: int = 5) -> List[Dict[str, Any]]:
        try:
            from django.contrib.postgres.search import (
                SearchVector, SearchQuery, SearchRank,
                TrigramSimilarity,
            )
            from django.db.models import F

            fts_vector = SearchVector("name", weight="A")
            fts_query = SearchQuery(query)
            tri = TrigramSimilarity("name", query)

            stops = (
                Stop.objects.annotate(
                    fts_rank=SearchRank(fts_vector, fts_query),
                    tri_score=tri,
                    score=F("fts_rank") + F("tri_score"),
                )
                .filter(tri_score__gt=0.15)
                .order_by("-score")
                .select_related("route")[:limit]
            )

            return [
                {
                    "place_id": f"stop-{stop.id}",
                    "lat": stop.location.y,
                    "lon": stop.location.x,
                    "name": stop.name,
                    "display_name": stop.name,
                }
                for stop in stops
            ]
        except Exception as exc:
            logger.error("Geocode DB stop search failed for query %s: %s", query, exc)
            return []

    @classmethod
    def search_stops_fts_trgm(
        cls,
        query: str,
        limit: int = 5,
        route_id: Optional[str] = None,
    ) -> List[Dict[str, Any]]:
        """
        Standalone DB-only stop search combining Full-Text Search (FTS) and
        Trigram similarity (pg_trgm) over Stop.name with a combined score.
        """
        try:
            from django.contrib.postgres.search import (
                SearchVector, SearchQuery, SearchRank, TrigramSimilarity,
            )
            from django.db.models import F, Q

            fts_vector = SearchVector("name", weight="A")
            fts_query = SearchQuery(query)
            tri = TrigramSimilarity("name", query)

            qs = Stop.objects.annotate(
                fts_rank=SearchRank(fts_vector, fts_query),
                tri_score=tri,
                score=F("fts_rank") + F("tri_score"),
            ).filter(
                Q(tri_score__gt=0.15) | Q(fts_rank__gt=0)
            ).order_by("-score").select_related("route__city")

            if route_id:
                qs = qs.filter(route_id=route_id)

            results = []
            for stop in qs[:limit]:
                route = stop.route
                city_name = route.city.name if route.city else ""
                route_label = " - ".join(
                    n for n in (route.start_name, route.end_name) if n
                )
                display = stop.name
                if route_label:
                    display = f"{stop.name}, {route_label}"
                results.append({
                    "place_id": f"stop-{stop.id}",
                    "id": str(stop.id),
                    "name": stop.name,
                    "display_name": display,
                    "lat": stop.location.y,
                    "lon": stop.location.x,
                    "route_id": str(stop.route_id),
                    "route_name": route.name,
                    "route_code": route.route_code,
                    "city_name": city_name,
                    "order": stop.order,
                    "score": round(stop.score, 4),
                })
            return results
        except Exception as exc:
            logger.error("Geocode DB stop FTS/trigram search failed for query %s: %s", query, exc)
            return []

    @classmethod
    def search_cached(
        cls,
        query: str,
        limit: int = 5,
        country_codes: str = "in",
    ) -> List[Dict[str, Any]]:
        """
        Orchestrated search:
        1. Redis cache hit -> return immediately.
        2. Cache miss -> DB stop search (GIN trigram) -> DB results.
        3. Circuit breaker open -> skip external, return DB only (not cached).
        4. Breaker closed -> external Nominatim; merge + store in Redis (24h).
        """
        from django.core.cache import cache

        from transport.services.circuit_breaker import GeocodeCircuitBreaker

        normalized = normalize_query(query)
        if not normalized:
            return []
        cache_key = build_search_cache_key(normalized, limit, country_codes)

        try:
            cached = cache.get(cache_key)
        except Exception as exc:
            logger.warning("Geocode cache read failed: %s", exc)
            cached = None
        if cached is not None:
            return cached

        db_results = cls.search_db_stops(normalized, limit)

        breaker = GeocodeCircuitBreaker()
        if breaker.is_open():
            logger.warning(
                "Geocode breaker open; returning DB results only for query: %s", normalized
            )
            return db_results

        api_results, ok = cls.search_nominatim(
            normalized,
            limit=limit,
            country_codes=country_codes,
            timeout=GEOCODE_SEARCH_TIMEOUT,
        )

        if not ok:
            breaker.record_failure()
            cls.schedule_cache_warmup(normalized, limit, country_codes)
            return db_results

        breaker.record_success()

        merged = db_results + api_results
        try:
            cache.set(cache_key, merged, GEOCODE_CACHE_TTL)
        except Exception as exc:
            logger.warning("Geocode cache write failed: %s", exc)
        return merged

    @classmethod
    def schedule_cache_warmup(cls, query: str, limit: int, country_codes: str) -> None:
        try:
            from transport.tasks import warm_geocode_cache

            warm_geocode_cache.apply_async(
                args=[query, limit, country_codes],
                countdown=GEOCODE_WARMUP_DELAY,
            )
        except Exception as exc:
            logger.warning("Could not schedule geocode cache warm-up: %s", exc)

    @classmethod
    def reverse(
        cls,
        lat: float,
        lon: float,
    ) -> Optional[Dict[str, Any]]:
        try:
            location = _geolocator.reverse(
                f"{lat}, {lon}",
                addressdetails=True,
                language="en",
            )
        except GeocoderTimedOut:
            logger.warning("Geocoding reverse timed out for %s, %s", lat, lon)
            return None
        except GeocoderServiceError as exc:
            logger.error("Geocoding reverse error for %s, %s: %s", lat, lon, exc)
            return None

        if not location:
            return None

        return _location_to_dict(location)