import json
import logging
from typing import Dict, Any

from tracking.services.location_service import LocationService

logger = logging.getLogger(__name__)


class LocationConsumer:
    """
    Consumer logic for location-related events.
    Usually invoked by Celery tasks that listen to RabbitMQ.
    """

    @staticmethod
    def handle_location_update(payload: Dict[str, Any]):
        """
        Handles raw location update event.
        """
        logger.info(f"Handling location update for vehicle: {payload.get('vehicle_id')}")
        
        try:
            # Idempotency is handled by the service (transactional updates)
            state = LocationService.process_location_update(payload)
            if state:
                logger.info(f"Successfully processed location update for {state.vehicle.vehicle_number}")
            else:
                logger.error("Failed to process location update")
        except Exception as e:
            logger.exception(f"Unexpected error in LocationConsumer: {e}")
            raise  # Re-raise for Celery retry
