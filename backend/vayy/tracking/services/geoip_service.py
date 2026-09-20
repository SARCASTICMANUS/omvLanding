import logging
import os
from typing import Optional

from django.conf import settings
from django.core.cache import cache

logger = logging.getLogger(__name__)

GEOIP_CACHE_TTL = 86400  # 24 hours


def _mmdb_exists() -> bool:
    return os.path.isfile(getattr(settings, "GEOIP_MMDB_PATH", ""))


def lookup_geoip(ip_address: str) -> Optional[dict]:
    if not _mmdb_exists():
        return None

    cache_key = f"geoip:{ip_address}"
    cached = cache.get(cache_key)
    if cached is not None:
        return cached

    try:
        from geoip2.database import Reader
        from geoip2.errors import AddressNotFoundError

        reader = Reader(settings.GEOIP_MMDB_PATH)
        try:
            city = reader.city(ip_address)
        except AddressNotFoundError:
            cache.set(cache_key, None, GEOIP_CACHE_TTL)
            return None

        result = {
            "city": city.city.name or "",
            "region": city.subdivisions.most_specific.name if city.subdivisions else "",
            "country": city.country.name or "",
            "country_code": city.country.iso_code or "",
            "latitude": city.location.latitude,
            "longitude": city.location.longitude,
            "timezone": city.location.time_zone or "",
        }
        cache.set(cache_key, result, GEOIP_CACHE_TTL)
        return result
    except Exception as e:
        logger.warning(f"GeoIP lookup failed for {ip_address}: {e}")
        return None


def persist_geo_event(payload: dict):
    from tracking.models import GeoEvent
    from django.contrib.gis.geos import Point

    location = None
    lat = payload.get("latitude")
    lng = payload.get("longitude")
    if lat is not None and lng is not None:
        location = Point(float(lng), float(lat), srid=4326)

    GeoEvent.objects.create(
        ip_address=payload["ip_address"],
        city=payload.get("city", ""),
        region=payload.get("region", ""),
        country=payload.get("country", ""),
        country_code=payload.get("country_code", ""),
        location=location,
        latitude=lat,
        longitude=lng,
        timezone=payload.get("timezone", ""),
    )
