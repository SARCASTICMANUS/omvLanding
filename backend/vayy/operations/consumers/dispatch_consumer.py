import logging
from typing import Dict, Any

from operations.services.dispatch_service import DispatchService
from accounts.models import User
from operations.models import ActiveTrip
from common.constants import (
    TRIP_STATUS_ASSIGNED, TRIP_STATUS_REQUESTED
)

logger = logging.getLogger(__name__)


class DispatchConsumer:
    """
    Handles dispatch assignment and ride request events from RabbitMQ.
    """

    @staticmethod
    def handle_assignment(payload: Dict[str, Any]):
        """
        Processes a dispatch assignment event.
        Validates the assignment and notifies the driver via WebSocket.
        """
        trip_id = payload.get("trip_id")
        driver_id = payload.get("driver_id")
        status = payload.get("status")

        logger.info(f"Processing dispatch assignment: trip={trip_id}, driver={driver_id}, status={status}")

        try:
            trip = ActiveTrip.objects.get(id=trip_id)
            driver = User.objects.get(id=driver_id)

            if status == TRIP_STATUS_ASSIGNED:
                # Notify driver of new assignment
                DispatchService._notify_ws(
                    f"notifications_{driver_id}",
                    "notification_broadcast",
                    {
                        "title": "New Assignment",
                        "message": f"You have a new ride request for {trip.route.name}",
                        "trip_id": str(trip.id),
                    },
                )
                logger.info(f"Dispatch assignment confirmed for trip {trip_id}")

        except ActiveTrip.DoesNotExist:
            logger.error(f"Trip {trip_id} not found for dispatch assignment")
        except User.DoesNotExist:
            logger.error(f"Driver {driver_id} not found for dispatch assignment")
        except Exception as e:
            logger.exception(f"Error handling dispatch assignment: {e}")
            raise

    @staticmethod
    def handle_request(payload: Dict[str, Any]):
        """
        Processes a ride request event.
        Delegates to DispatchService to find candidates and assign a driver.
        """
        passenger_id = payload.get("passenger_id")
        route_id = payload.get("route_id")
        pickup_stop_id = payload.get("pickup_stop_id")
        mode = payload.get("mode", "direct")

        logger.info(f"Processing ride request: passenger={passenger_id}, route={route_id}, mode={mode}")

        try:
            passenger = User.objects.get(id=passenger_id)
            result = DispatchService.request_dispatch(
                passenger=passenger,
                route_id=route_id,
                pickup_stop_id=pickup_stop_id,
                mode=mode,
            )
            logger.info(f"Ride request processed: {result}")

        except User.DoesNotExist:
            logger.error(f"Passenger {passenger_id} not found for ride request")
        except Exception as e:
            logger.exception(f"Error handling ride request: {e}")
            raise
