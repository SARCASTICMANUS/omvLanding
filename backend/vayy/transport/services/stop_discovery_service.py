"""Spatial lookup of existing city global stops."""

from django.contrib.gis.db.models.functions import Distance
from django.contrib.gis.measure import D

from transport.models import Stop


class StopDiscoveryService:
    DEFAULT_LIMIT = 20

    @classmethod
    def nearby_global_stops(cls, city_id, point, radius_m, limit=None):
        """Return nearest global stops, optionally limited by passenger walk radius."""
        limit = max(1, min(int(limit or cls.DEFAULT_LIMIT), 50))
        stops = Stop.objects.filter(city_id=city_id, is_global=True)
        if radius_m is not None:
            stops = stops.filter(location__distance_lte=(point, D(m=radius_m)))
        return list(stops.annotate(distance_m=Distance("location", point)).order_by("distance_m", "id")[:limit])
