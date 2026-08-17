from geopy.geocoders import Nominatim as GeopyNominatim


_geolocator = GeopyNominatim(user_agent="vayy/1.0", timeout=10)


class GeocodingService:

    @classmethod
    def search(cls, query, limit=5, country_codes="in"):
        location = _geolocator.geocode(
            query,
            country_codes=country_codes,
            addressdetails=True,
            limit=limit,
            language="en",
        )
        if not location:
            return []

        raw = location.raw
        address = raw.get("address", {})

        entry = {
            "place_id": raw.get("place_id"),
            "licence": raw.get("licence", ""),
            "osm_type": raw.get("osm_type", ""),
            "osm_id": raw.get("osm_id", 0),
            "lat": str(location.latitude),
            "lon": str(location.longitude),
            "display_name": location.address,
            "type": raw.get("type", ""),
            "class": raw.get("class", ""),
            "address": address,
        }
        return [entry]

    @classmethod
    def reverse(cls, lat, lon):
        location = _geolocator.reverse(
            f"{lat}, {lon}",
            addressdetails=True,
            language="en",
        )
        if not location:
            return None

        raw = location.raw
        address = raw.get("address", {})

        return {
            "place_id": raw.get("place_id"),
            "licence": raw.get("licence", ""),
            "osm_type": raw.get("osm_type", ""),
            "osm_id": raw.get("osm_id", 0),
            "lat": str(location.latitude),
            "lon": str(location.longitude),
            "display_name": location.address,
            "type": raw.get("type", ""),
            "class": raw.get("class", ""),
            "address": address,
        }
