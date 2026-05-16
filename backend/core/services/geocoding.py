import json
import logging
from hashlib import sha256

from geopy.exc import GeocoderTimedOut, GeocoderUnavailable
from geopy.geocoders import Nominatim

from core.services.redis_service import get_redis_client

logger = logging.getLogger(__name__)

GEOCODING_TTL_SECONDS = 60 * 60 * 24 * 7
GEOCODER = Nominatim(user_agent="vayy-app")


class GeocodingUnavailable(Exception):
    pass


def _cache_key(prefix, value):
    digest = sha256(str(value).strip().lower().encode("utf-8")).hexdigest()
    return f"geocode:{prefix}:{digest}"


def _get_cached(key):
    try:
        value = get_redis_client().get(key)
        return json.loads(value) if value else None
    except Exception as exc:
        logger.warning("Geocoding cache read failed: %s", exc)
        return None


def _set_cached(key, value):
    try:
        get_redis_client().set(key, json.dumps(value), ex=GEOCODING_TTL_SECONDS)
    except Exception as exc:
        logger.warning("Geocoding cache write failed: %s", exc)


def search_locations(query, limit=5):
    normalized_query = (query or "").strip()
    if not normalized_query:
        return []

    key = _cache_key("search", f"{normalized_query}:{limit}")
    cached = _get_cached(key)
    if cached is not None:
        return cached

    try:
        locations = GEOCODER.geocode(normalized_query, exactly_one=False, limit=limit)
    except (GeocoderTimedOut, GeocoderUnavailable) as exc:
        raise GeocodingUnavailable from exc

    results = [
        {
            "display_name": loc.address,
            "lat": loc.latitude,
            "lon": loc.longitude,
        }
        for loc in locations or []
    ]
    _set_cached(key, results)
    return results


def reverse_location(lat, lon):
    key = _cache_key("reverse", f"{lat},{lon}")
    cached = _get_cached(key)
    if cached is not None:
        return cached

    try:
        location = GEOCODER.reverse(f"{lat}, {lon}")
    except (GeocoderTimedOut, GeocoderUnavailable) as exc:
        raise GeocodingUnavailable from exc

    if not location:
        return None

    result = {
        "display_name": location.address,
        "lat": location.latitude,
        "lon": location.longitude,
    }
    _set_cached(key, result)
    return result
