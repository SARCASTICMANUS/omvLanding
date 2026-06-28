import logging
from typing import List, Dict, Any
from abc import ABC, abstractmethod
from django.core.cache import cache
from operations.models import ActiveTrip
from transport.models import Stop
from tracking.services.event_publisher import TrackingEventPublisher

logger = logging.getLogger(__name__)


class BaseETAProvider(ABC):
    @abstractmethod
    def calculate(self, origin: Any, destination: Any) -> Dict[str, Any]:
        pass


class OSRMProvider(BaseETAProvider):
    def calculate(self, origin, destination):
        """
        OSRM-based road distance/time estimation.
        Falls back to great-circle estimation if OSRM is unavailable.
        """
        from transport.services.osrm_service import OSRMService
        duration_s = OSRMService.get_road_duration_s(
            (origin.x, origin.y), (destination.x, destination.y)
        )
        distance_m = OSRMService.get_road_distance_m(
            (origin.x, origin.y), (destination.x, destination.y)
        )

        if duration_s is not None and distance_m is not None:
            return {
                "distance_km": round(distance_m / 1000.0, 2),
                "duration_minutes": round(duration_s / 60.0, 1),
            }

        distance_km = origin.distance(destination) * 100
        eta_minutes = (distance_km / 20) * 60
        return {
            "distance_km": round(distance_km, 2),
            "duration_minutes": round(eta_minutes, 1),
        }


class ETAService:
    """
    Advanced ETA service with provider abstraction and caching.
    """
    
    _provider = OSRMProvider()

    @staticmethod
    def calculate_eta(trip_id, next_stop_id, minutes=None):
        """
        Calculates and publishes ETA for a specific stop.
        """
        cache_key = f"eta_{trip_id}_{next_stop_id}"
        cached_eta = cache.get(cache_key)
        
        if cached_eta and minutes is None:
            return cached_eta

        payload = {
            "trip_id": str(trip_id),
            "next_stop": str(next_stop_id),
            "eta_minutes": minutes,
        }

        TrackingEventPublisher.publish_eta_update(payload)
        cache.set(cache_key, payload, timeout=30) # Cache for 30 seconds

        return payload

    @staticmethod
    def get_stop_etas(stop_id: str) -> List[Dict[str, Any]]:
        """
        Calculates ETAs for all active trips approaching a specific stop.
        """
        try:
            target_stop = Stop.objects.get(id=stop_id)
            active_trips = ActiveTrip.objects.filter(
                route=target_stop.route,
                status="active",
                current_location__isnull=False
            ).select_related('vehicle')

            etas = []
            for trip in active_trips:
                # Use provider to calculate real ETA
                result = ETAService._provider.calculate(
                    trip.current_location, 
                    target_stop.location
                )

                eta_data = {
                    "trip_id": str(trip.id),
                    "vehicle_number": trip.vehicle.vehicle_number,
                    "distance_km": result["distance_km"],
                    "eta_minutes": result["duration_minutes"],
                    "last_updated": trip.last_updated.isoformat()
                }
                etas.append(eta_data)

            # Sort by ETA
            etas.sort(key=lambda x: x['eta_minutes'])
            return etas

        except Stop.DoesNotExist:
            logger.error(f"Stop {stop_id} not found for ETA calculation")
            return []
        except Exception as e:
            logger.exception(f"Error calculating stop ETAs: {e}")
            return []
