import requests


class GeocodingService:

    BASE_URL = "https://nominatim.openstreetmap.org"

    @classmethod
    def reverse_geocode(
        cls,
        latitude,
        longitude,
    ):
        response = requests.get(
            f"{cls.BASE_URL}/reverse",
            params={
                "lat": latitude,
                "lon": longitude,
                "format": "json",
            },
            timeout=10,
        )

        return response.json()