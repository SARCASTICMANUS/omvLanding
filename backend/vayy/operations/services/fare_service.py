"""
Centralized fare calculation service.

Single source of truth for ride fares across the platform so the fare an
passenger is quoted (estimate), the fare shown on a route search, and the
fare charged on completion are always identical.

Fare configuration is now stored in the ``FareConfiguration`` model (one row
per vehicle type, with an ``is_active`` flag).  When no active configuration
exists the static defaults below are used, so the system degrades gracefully
until an admin sets new rates.
"""

from typing import Optional

from django.utils import timezone

from common.constants import VEHICLE_BIKE, VEHICLE_AUTO
from operations.models import FareConfiguration


def _active_fare_config() -> Optional[FareConfiguration]:
    """
    Return the currently active ``FareConfiguration`` row, or ``None`` if none
    is marked ``is_active``.
    """
    return FareConfiguration.objects.filter(is_active=True).first()


def _default_rate(vehicle_type: str) -> dict:
    """Fallback rates used when no active configuration exists."""
    return {
        VEHICLE_AUTO: {"base_fare": 30, "per_km_rate": 10},
        VEHICLE_BIKE: {"base_fare": 20, "per_km_rate": 5},
        "default": {"base_fare": 50, "per_km_rate": 15},
    }.get(vehicle_type, {"base_fare": 50, "per_km_rate": 15})


def _rate_for(vehicle_type: str) -> dict:
    """Fetch the active configuration rate, falling back to defaults."""
    config = _active_fare_config()
    if config is not None:
        return {"base_fare": config.base_fare, "per_km_rate": config.per_km_rate}
    return _default_rate(vehicle_type)


class FareService:
    """Fare calculation helpers backed by the ``FareConfiguration`` model."""

    @staticmethod
    def get_base_fare(vehicle_type: str) -> int:
        return _rate_for(vehicle_type)["base_fare"]

    @staticmethod
    def get_per_km_rate(vehicle_type: str) -> int:
        return _rate_for(vehicle_type)["per_km_rate"]

    @staticmethod
    def calculate_fare(distance_km: float, vehicle_type: str) -> float:
        """Total fare for a given road distance (km) and vehicle type."""
        rate = _rate_for(vehicle_type)
        return round(float(rate["base_fare"] + (distance_km * rate["per_km_rate"])), 2)

    @staticmethod
    def calculate_fare_breakdown(
        distance_km: float, vehicle_type: str, duration_min: Optional[float] = None
    ) -> dict:
        """
        Consistent fare breakdown consumed by the frontend.

        The fare model is base + per-km only; duration is informational and is
        never charged, so base_fare + distance_fare always equals total_fare.
        """
        rate = _rate_for(vehicle_type)
        base_fare = rate["base_fare"]
        per_km_rate = rate["per_km_rate"]
        distance_fare = round(float(distance_km * per_km_rate), 2)
        total_fare = round(float(base_fare + distance_fare), 2)
        return {
            "base_fare": base_fare,
            "per_km_charge": per_km_rate,
            "distance_km": round(float(distance_km), 2),
            "distance_fare": distance_fare,
            "total_fare": total_fare,
            "duration_min": round(float(duration_min), 1) if duration_min is not None else None,
        }