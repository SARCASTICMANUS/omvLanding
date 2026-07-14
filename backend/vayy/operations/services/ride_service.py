import logging
from typing import Dict, Any
from django.contrib.gis.geos import Point
from django.contrib.gis.measure import D
from django.contrib.gis.db.models.functions import Distance
from operations.models import Vehicle, VehicleState
from operations.api.serializers import RideEstimateResponseSerializer

logger = logging.getLogger(__name__)

class RideService:
    """
    Service for passenger ride-related logic.
    """

    @staticmethod
    def calculate_estimate(pickup_lat: float, pickup_lng: float, drop_lat: float, drop_lng: float, vehicle_type: str) -> Dict[str, Any]:
        """
        Calculates ride estimates including distance, duration, and fare.
        """
        pickup_point = Point(pickup_lng, pickup_lat, srid=4326)
        drop_point = Point(drop_lng, drop_lat, srid=4326)
        
        # Use OSRM for actual road distance/time
        from transport.services.osrm_service import OSRMService
        distance_m = OSRMService.get_road_distance_m(
            (pickup_lng, pickup_lat), (drop_lng, drop_lat)
        )
        duration_s = OSRMService.get_road_duration_s(
            (pickup_lng, pickup_lat), (drop_lng, drop_lat)
        )

        if distance_m is not None and duration_s is not None:
            distance_km = distance_m / 1000.0
            duration_minutes = duration_s / 60.0
        else:
            distance_km = pickup_point.distance(drop_point) * 100 * 1.3
            duration_minutes = (distance_km / 25) * 60 + 5
        
        # Base fare calculation
        base_fares = {
            "auto": 30,
            "bike": 20,
        }
        
        per_km_rates = {
            "auto": 10,
            "bike": 5,
        }
        
        base_fare = base_fares.get(vehicle_type, 50)
        per_km_rate = per_km_rates.get(vehicle_type, 15)
        
        estimated_fare = base_fare + (distance_km * per_km_rate)
        
        # Surge multiplier (mock logic)
        surge_multiplier = 1.0
        
        return {
            "distance_km": round(distance_km, 2),
            "duration_minutes": round(duration_minutes, 1),
            "estimated_fare": round(estimated_fare, 2),
            "surge_multiplier": surge_multiplier,
            "vehicle_type": vehicle_type
        }

    @staticmethod
    def calculate_final_fare(trip) -> float:
        """
        Calculates the final fare for a completed trip.
        """
        distance_km = trip.route.total_distance_meters / 1000.0
        if distance_km == 0:
            distance_km = 5.0 # Default fallback
            
        vehicle_type = trip.vehicle.vehicle_type
        
        base_fares = {"auto": 30, "bike": 20}
        per_km_rates = {"auto": 10, "bike": 5}
        
        base_fare = base_fares.get(vehicle_type, 50)
        per_km_rate = per_km_rates.get(vehicle_type, 15)
        
        final_fare = base_fare + (distance_km * per_km_rate)
        return round(float(final_fare), 2)

    @staticmethod
    def get_nearby_vehicles(lat: float, lng: float, radius_m: int, vehicle_type: str = None):
        """
        Finds active vehicles near a location.
        """
        point = Point(lng, lat, srid=4326)
        
        # Query VehicleState for active vehicles within radius
        queryset = VehicleState.objects.filter(
            vehicle__is_active=True,
            current_location__distance_lte=(point, D(m=radius_m))
        ).annotate(
            distance=Distance('current_location', point)
        ).order_by('distance').select_related('vehicle', 'active_trip')
        
        if vehicle_type:
            queryset = queryset.filter(vehicle__vehicle_type=vehicle_type)

        return queryset
