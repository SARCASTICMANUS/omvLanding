import logging
from celery import shared_task
from django.utils import timezone
from datetime import timedelta
from operations.models import ActiveTrip
from operations.consumers.dispatch_consumer import DispatchConsumer
from operations.constants import TRIP_STATUS_ASSIGNED, TRIP_STATUS_CANCELLED

logger = logging.getLogger(__name__)


@shared_task
def check_assignment_timeout(trip_id):
    """
    Checks if a trip assignment has timed out.
    """
    try:
        trip = ActiveTrip.objects.get(id=trip_id, status=TRIP_STATUS_ASSIGNED)
        # If still assigned after timeout, cancel and notify
        trip.status = TRIP_STATUS_CANCELLED
        trip.ended_at = timezone.now()
        trip.save()

        logger.warning(f"Trip {trip_id} timed out and was cancelled.")
        # In a real app, trigger find_best_candidates again for a new driver
    except ActiveTrip.DoesNotExist:
        pass


@shared_task
def expire_broadcast_request(request_id):
    """
    Expires a broadcast dispatch request after timeout (90s).
    Notifies all drivers to dismiss popup, and notifies passenger.
    """
    from operations.models import DispatchRequest
    from asgiref.sync import async_to_sync
    from channels.layers import get_channel_layer

    try:
        dispatch_request = DispatchRequest.objects.get(id=request_id)

        if dispatch_request.status != DispatchRequest.STATUS_PENDING:
            return

        dispatch_request.status = DispatchRequest.STATUS_EXPIRED
        dispatch_request.save()

        channel_layer = get_channel_layer()

        # Notify all drivers → dismiss popup
        for driver_id_str in dispatch_request.notified_drivers:
            async_to_sync(channel_layer.group_send)(
                f"notifications_{driver_id_str}",
                {
                    "type": "notification_broadcast",
                    "data": {
                        "type": "request_expired",
                        "request_id": str(dispatch_request.id),
                    },
                },
            )

        # Notify passenger → no drivers available
        # Passenger listens on a broadcast_{request_id} group
        async_to_sync(channel_layer.group_send)(
            f"broadcast_{dispatch_request.id}",
            {
                "type": "broadcast_update",
                "data": {
                    "type": "no_drivers_available",
                    "request_id": str(dispatch_request.id),
                },
            },
        )

        logger.info(f"Broadcast dispatch {request_id} expired — notified {len(dispatch_request.notified_drivers)} drivers")

    except DispatchRequest.DoesNotExist:
        logger.warning(f"Broadcast dispatch {request_id} not found for expiry")


@shared_task(
    bind=True,
    default_retry_delay=10,
    queue="dispatch"
)
def process_dispatch_assignment(self, payload):
    """
    Celery task to handle dispatch assignment events.
    """
    try:
        DispatchConsumer.handle_assignment(payload)
    except Exception as exc:
        logger.error(f"Error handling dispatch assignment: {exc}")
        raise self.retry(exc=exc)


@shared_task(
    bind=True,
    max_retries=3,
    default_retry_delay=10,
    queue="dispatch"
)
def process_ride_request(self, payload):
    """
    Celery task to handle ride request events.
    """
    try:
        DispatchConsumer.handle_request(payload)
    except Exception as exc:
        logger.error(f"Error handling ride request: {exc}")
        raise self.retry(exc=exc)


@shared_task(
    bind=True,
    max_retries=3,
    default_retry_delay=5,
    queue="dispatch"
)
def process_boarding_event(self, payload):
    """
    Celery task to process boarding events from RabbitMQ.
    Broadcasts hand raise/lower notifications to driver via Django Channels WS.
    """
    try:
        from asgiref.sync import async_to_sync
        from channels.layers import get_channel_layer

        event_type = payload.get("event_type", "hand_raised")
        trip_id = payload.get("trip_id")
        passenger_id = payload.get("passenger_id")
        passenger_name = payload.get("passenger_name", "Passenger")
        boarding_request_id = payload.get("request_id", "")
        pickup_stop_name = payload.get("pickup_stop_name", "")

        if not trip_id:
            logger.error(f"Missing trip_id in boarding event payload: {payload}")
            return

        from operations.models import ActiveTrip
        trip = ActiveTrip.objects.select_related("route").get(id=trip_id)

        channel_layer = get_channel_layer()
        route_id = str(trip.route_id)

        ws_payload = {
            "type": "passenger_update",
            "data": {
                "type": "boarding_update",
                "event": event_type,
                "user_id": str(passenger_id),
                "passenger_name": passenger_name,
                "boarding_request_id": boarding_request_id,
                "pickup_stop_name": pickup_stop_name,
                "hand_raised": event_type == "hand_raised",
            }
        }

        async_to_sync(channel_layer.group_send)(
            f"route_passengers_{route_id}",
            ws_payload,
        )

        logger.info(f"Boarding event processed: {event_type} for passenger {passenger_id} on route {route_id}")

    except ActiveTrip.DoesNotExist:
        logger.error(f"Trip not found for boarding event: {trip_id}")
    except Exception as exc:
        logger.error(f"Error processing boarding event: {exc}")
        raise self.retry(exc=exc)
