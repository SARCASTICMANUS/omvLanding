import logging
from typing import Dict, Any
from django.contrib.gis.geos import Point
from django.contrib.gis.measure import D
from django.contrib.gis.db.models.functions import Distance
from operations.models import Vehicle, VehicleState
from operations.api.serializers import RideEstimateResponseSerializer
from operations.services.fare_service import FareService

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
        
        # Use OSRM for actual road distance/time (single cached call)
        from transport.services.osrm_service import OSRMService
        metrics = OSRMService.get_road_metrics(
            (pickup_lng, pickup_lat), (drop_lng, drop_lat)
        )

        if metrics:
            distance_km = metrics["distance"] / 1000.0
            duration_minutes = metrics["duration"] / 60.0
        else:
            from tracking.services.geo_service import GeoService
            distance_km = (
                GeoService.haversine_m(pickup_lat, pickup_lng, drop_lat, drop_lng)
                / 1000.0 * 1.3
            )
            duration_minutes = (distance_km / 25) * 60 + 5
        
        # Fare from the shared service so estimates always match final fare
        estimated_fare = FareService.calculate_fare(distance_km, vehicle_type)
        
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
    def calculate_segment_fare(pickup_stop, drop_stop, vehicle_type: str) -> float:
        """
        Calculates fare for a specific segment between two stops.
        """
        if not pickup_stop or not drop_stop:
            return 0.0
        
        pickup_lat = pickup_stop.location.y
        pickup_lng = pickup_stop.location.x
        drop_lat = drop_stop.location.y
        drop_lng = drop_stop.location.x
        
        estimate = RideService.calculate_estimate(pickup_lat, pickup_lng, drop_lat, drop_lng, vehicle_type)
        return estimate.get("estimated_fare", 0.0)

    @staticmethod
    def calculate_final_fare(trip) -> float:
        """
        Calculates the final fare for a completed trip.
        """
        distance_km = trip.route.total_distance_meters / 1000.0
        if distance_km == 0:
            distance_km = 5.0 # Default fallback
            
        vehicle_type = trip.vehicle.vehicle_type
        
        return FareService.calculate_fare(distance_km, vehicle_type)

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
