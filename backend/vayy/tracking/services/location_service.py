import logging
from typing import Dict, Any, Optional
from django.utils import timezone
from django.db import transaction
from django.contrib.gis.geos import Point
from asgiref.sync import async_to_sync
from channels.layers import get_channel_layer

from operations.models import Vehicle, ActiveTrip, VehicleState
from tracking.models import HybridLog
from tracking.services.geo_service import GeoService

logger = logging.getLogger(__name__)


class LocationService:

    @staticmethod
    def _notify_ws(group_name: str, event_type: str, data: Dict[str, Any]):
        channel_layer = get_channel_layer()
        async_to_sync(channel_layer.group_send)(
            group_name,
            {
                "type": event_type,
                "data": data
            }
        )

    @staticmethod
    @transaction.atomic
    def process_location_update(payload: Dict[str, Any]) -> Optional[VehicleState]:
        vehicle_id = payload.get("vehicle_id")
        lat = payload.get("lat")
        lng = payload.get("lng") or payload.get("lon")
        speed = payload.get("speed", 0)
        heading = payload.get("heading", 0)
        trip_id = payload.get("trip_id")

        if not vehicle_id or lat is None or lng is None:
            logger.error(f"Invalid location update payload: {payload}")
            return None

        try:
            vehicle = Vehicle.objects.get(id=vehicle_id)
            point = GeoService.create_point(lat, lng)

            # 1. Update Vehicle State
            state, created = VehicleState.objects.get_or_create(vehicle=vehicle)
            state.speed_kmph = speed
            state.heading = heading
            state.current_location = point
            state.last_updated = timezone.now()

            # 2. Store HybridLog for persistence
            try:
                from accounts.models import User
                driver = vehicle.driver if hasattr(vehicle, 'driver') and vehicle.driver else None
                HybridLog.objects.create(
                    user=driver if driver else None,
                    vehicle=vehicle,
                    trip=None,
                    location=point,
                    speed=speed,
                    heading=heading,
                    timestamp=timezone.now(),
                )
            except Exception as e:
                logger.warning(f"Failed to store HybridLog: {e}")

            # 3. Update Active Trip if provided or if one exists
            active_trip = None
            if trip_id:
                try:
                    active_trip = ActiveTrip.objects.get(id=trip_id, status="active")
                except ActiveTrip.DoesNotExist:
                    logger.warning(f"ActiveTrip {trip_id} not found for vehicle {vehicle_id}")

            if not active_trip:
                active_trip = ActiveTrip.objects.filter(vehicle=vehicle, status="active").first()

            if active_trip:
                active_trip.current_location = point
                active_trip.last_updated = timezone.now()
                active_trip.save(update_fields=["current_location", "last_updated"])
                state.active_trip = active_trip

            state.save()

            # 4. Broadcast to WebSockets — format matches frontend expectation
            ws_payload = {
                "type": "vehicle_update",
                "lat": lat,
                "lng": lng,
                "speed": speed,
                "heading": heading,
                "vehicle_id": str(vehicle_id),
                "trip_id": str(active_trip.id) if active_trip else None,
                "next_stop_eta": [],
                "timestamp": state.last_updated.isoformat(),
            }

            LocationService._notify_ws(f"vehicle_{vehicle_id}", "vehicle_update", ws_payload)
            if active_trip:
                LocationService._notify_ws(f"trip_{active_trip.id}", "trip_update", ws_payload)

            logger.info(f"Updated state and broadcast for vehicle {vehicle_id} at {lat}, {lng}")
            return state

        except Vehicle.DoesNotExist:
            logger.error(f"Vehicle {vehicle_id} not found")
            return None
        except Exception as e:
            logger.exception(f"Error processing location update: {e}")
            raise
