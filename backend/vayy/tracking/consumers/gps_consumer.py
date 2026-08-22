import logging
from typing import Dict, Any

from tracking.services.gps_service import GPSService
from accounts.models import User
from operations.models import Vehicle, ActiveTrip

logger = logging.getLogger(__name__)


class GPSConsumer:
    """
    Handles raw GPS ingestion events.
    """

    @staticmethod
    def handle_gps_raw(payload: Dict[str, Any]):
        """
        Ingests raw GPS data and stores it in HybridLog.
        """
        user_id = payload.get("user_id")
        vehicle_id = payload.get("vehicle_id")
        trip_id = payload.get("trip_id")
        
        try:
            user = User.objects.get(id=user_id) if user_id else None
            vehicle = Vehicle.objects.get(id=vehicle_id) if vehicle_id else None
            trip = ActiveTrip.objects.get(id=trip_id) if trip_id else None

            GPSService.ingest(
                user=user,
                vehicle=vehicle,
                trip=trip,
                lat=payload["lat"],
                lng=payload["lng"],
                speed=payload.get("speed", 0),
                heading=payload.get("heading", 0),
                cell_towers=payload.get("cell_towers"),
                wifi_aps=payload.get("wifi_aps"),
            )
            logger.info(f"Raw GPS ingested for user {user_id}")
        except Exception as e:
            logger.exception(f"Error in GPSConsumer: {e}")
            raise
