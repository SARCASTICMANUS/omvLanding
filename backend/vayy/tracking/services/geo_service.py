import math

from django.contrib.gis.geos import Point


class GeoService:

    @staticmethod
    def create_point(lat, lng):
        return Point(lng, lat, srid=4326)

    @staticmethod
    def extract_lat_lng(point):
        if not point:
            return None, None
        return point.y, point.x

    @staticmethod
    def haversine_m(lat1, lng1, lat2, lng2):
        """Great-circle distance in metres (WGS84) - accurate degree→m."""
        r = 6371000.0
        p1 = math.radians(lat1)
        p2 = math.radians(lat2)
        dp = math.radians(lat2 - lat1)
        dl = math.radians(lng2 - lng1)
        a = math.sin(dp / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
        return 2 * r * math.asin(math.sqrt(a))