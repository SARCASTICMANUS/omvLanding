import logging
from typing import List, Dict, Any
from abc import ABC, abstractmethod
from django.core.cache import cache
from common.constants import TRIP_STATUS_ACTIVE
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
        OSRM basis road distance/time estimation.
        Single cached /route call; falls back to great-circle estimation.
        """
        from transport.services.osrm_service import OSRMService
        metrics = OSRMService.get_road_metrics(
            (origin.x, origin.y), (destination.x, destination.y)
        )
        if metrics:
            return {
                "distance_km": round(metrics["distance"] / 1000.0, 2),
                "duration_minutes": round(metrics["duration"] / 60.0, 1),
            }

        from tracking.services.geo_service import GeoService
        distance_m = GeoService.haversine_m(origin.y, origin.x, destination.y, destination.x)
        eta_minutes = (distance_m / 1000 / 20) * 60
        return {
            "distance_km": round(distance_m / 1000, 2),
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
    def get_stop_etas(strip_id: str) -> List[Dict[str, Any]]:
        """
        Calculates ETAs for all active vehicles approaching a specific stop.

        Covers both scopes: route trips running the stop's route, and journeys
        whose path passes a global stop. The two used to be the same query, but
        a global stop has no route, so filtering by it would have returned
        nothing for exactly the stops the journey flow serves.
        """
        try:
            from tracking.services.corridor_service import CorridorService
            from operations.services.dispatch_service import DispatchService

            target_stop = Stop.objects.get(id=stop_id)
            etas = []

            if target_stop.is_global:
                # Journey flow: the passing-trip index is the candidate set.
                candidates = DispatchService.find_candidates_for_stop(
                    str(target_stop.id), limit=10
                )
                for candidate in candidates:
                    trip = candidate["trip"]
                    eta_s = CorridorService.eta_to_stop_s(str(trip.id), str(stop_id))
                    etas.append({
                        "trip_id": str(trip.id),
                        "vehicle_number": candidate["vehicle"].vehicle_number,
                        "distance_km": candidate["distance"],
                        "eta_minutes": round((eta_s or 0) / 60.0, 1),
                        "is_journey": True,
                        "last_updated": trip.last_updated.isoformat(),
                    })

            else:
                active_trips = ActiveTrip.objects.filter(
                    route=target_stop.route,
                    status=TRIP_STATUS_ACTIVE,
                    current_location__isnull=False
                ).select_related('vehicle')

                for trip in active_trips:
                    # Use provider to calculate real ETA
                    result = ETAService._provider.calculate(
                        trip.current_location,
                        target_stop.location
                    )

                    etas.append({
                        "trip_id": str(trip.id),
                        "vehicle_number": trip.vehicle.vehicle_number,
                        "distance_km": result["distance_km"],
                        "eta_minutes": result["duration_minutes"],
                        "is_journey": False,
                        "last_updated": trip.last_updated.isoformat()
                    })

            # Sort by ETA
            etas.sort(key=lambda x: x['eta_minutes'])
            return etas

        except Stop.DoesNotExist:
            logger.error(f"Stop {stop_id} not found for ETA calculation")
            return []
        except Exception as e:
            logger.exception(f"Error calculating stop ETAs: {e}")
            return []
