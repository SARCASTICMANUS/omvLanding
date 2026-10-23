"""Spatial lookup of existing city global stops for passenger endpoints."""

from django.contrib.gis.db.models.functions import Distance
from django.contrib.gis.measure import D

from transport.models import Stop


class StopDiscoveryService:
    DEFAULT_LIMIT = 20

    @classmethod
    def nearby_global_stops(cls, city_id, point, radius_m, limit=None):
        """Return the nearest usable global stops, regardless of review status."""
        limit = max(1, min(int(limit or cls.DEFAULT_LIMIT), 50))
        return list(
            Stop.objects.filter(
                city_id=city_id,
                is_global=True,
                location__distance_lte=(point, D(m=radius_m)),
            )
            .annotate(distance_m=Distance("location", point))
            .order_by("distance_m", "id")[:limit]
        )
