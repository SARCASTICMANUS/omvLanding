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