from typing import Any, Dict, List, Optional

from geopy.geocoders import Nominatim as GeopyNominatim
from geopy.location import Location

_geolocator = GeopyNominatim(user_agent="vayy/1.0", timeout=10)


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
    def search(
        cls,
        query: str,
        limit: int = 5,
        country_codes: str = "in",
    ) -> List[Dict[str, Any]]:
        results = _geolocator.geocode(
            query,
            exactly_one=False,
            country_codes=country_codes,
            addressdetails=True,
            limit=limit,
            language="en",
        )
        if not results:
            return []

        if isinstance(results, Location):
            return [_location_to_dict(results)]

        return [_location_to_dict(r) for r in results]

    @classmethod
    def reverse(
        cls,
        lat: float,
        lon: float,
    ) -> Optional[Dict[str, Any]]:
        location = _geolocator.reverse(
            f"{lat}, {lon}",
            addressdetails=True,
            language="en",
        )
        if not location:
            return None

        return _location_to_dict(location)
