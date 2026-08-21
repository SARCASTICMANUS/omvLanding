"""
Centralized fare calculation service.

Single source of truth for ride fares across the platform so the price a
passenger is quoted (estimate), the price shown on a route search, and the
price charged on completion are always identical.

Formula: fare = base_fare + (distance_km * per_km_rate)
"""

from typing import Optional

# Vehicle-type fare rates. Any vehicle type not listed falls back to "default".
VEHICLE_FARE_RATES = {
    "auto": {"base_fare": 30, "per_km_rate": 10},
    "bike": {"base_fare": 20, "per_km_rate": 5},
    "default": {"base_fare": 50, "per_km_rate": 15},
}


def _get_rate(vehicle_type: str) -> dict:
    return VEHICLE_FARE_RATES.get(vehicle_type, VEHICLE_FARE_RATES["default"])


class FareService:
    """Static fare calculation helpers used by all fare call sites."""

    @staticmethod
    def get_base_fare(vehicle_type: str) -> int:
        return _get_rate(vehicle_type)["base_fare"]

    @staticmethod
    def get_per_km_rate(vehicle_type: str) -> int:
        return _get_rate(vehicle_type)["per_km_rate"]

    @staticmethod
    def calculate_fare(distance_km: float, vehicle_type: str) -> float:
        """Total fare for a given road distance (km) and vehicle type."""
        rate = _get_rate(vehicle_type)
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
        rate = _get_rate(vehicle_type)
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