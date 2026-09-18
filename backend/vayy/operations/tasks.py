import logging
from celery import shared_task
from django.utils import timezone
from datetime import timedelta
from operations.models import ActiveTrip, BoardingRequest
from operations.consumers.dispatch_consumer import DispatchConsumer
from common.constants import TRIP_STATUS_ASSIGNED, TRIP_STATUS_CANCELLED, TRIP_STATUS_REJECTED

logger = logging.getLogger(__name__)


@shared_task
def check_assignment_timeout(trip_id):
    """
    Cascading timeout: if trip still ASSIGNED after 10s,
    reject current candidate and re-dispatch to next best.
    Cancel only after all candidates exhausted.
    """
    from operations.services.dispatch_service import DispatchService
    from asgiref.sync import async_to_sync
    from channels.layers import get_channel_layer

    try:
        trip = ActiveTrip.objects.select_for_update().get(
            id=trip_id, status=TRIP_STATUS_ASSIGNED
        )
    except ActiveTrip.DoesNotExist:
        return  # Trip already moved to another state (accepted/rejected)

    # Find the boarding request to get passenger and stop info
    boarding = BoardingRequest.objects.filter(trip=trip).first()
    if not boarding:
        trip.status = TRIP_STATUS_CANCELLED
        trip.ended_at = timezone.now()
        trip.save()
        return

    route_id = str(trip.route_id)
    pickup_stop_id = str(boarding.pickup_stop_id)
    excluded_driver_id = str(trip.driver_id)

    # Mark current trip as rejected (driver timed out)
    trip.status = TRIP_STATUS_REJECTED
    trip.ended_at = timezone.now()
    trip.save()

    # Find next candidates excluding the timed-out driver
    candidates = DispatchService.find_best_candidates(
        route_id, pickup_stop_id, limit=5, exclude_drivers={excluded_driver_id}
    )

    if candidates:
        # Assign to next best candidate
        result = DispatchService._assign_to_driver(
            passenger=boarding.passenger,
            route_id=route_id,
            pickup_stop_id=pickup_stop_id,
            candidate=candidates[0],
            drop_stop_id=str(boarding.drop_stop_id) if boarding.drop_stop else None,
        )
        logger.info(
            f"Trip {trip_id}: cascaded from driver {excluded_driver_id} "
            f"to {candidates[0]['driver'].id} — status={result.get('status')}"
        )
    else:
        # No more candidates — notify passenger
        logger.warning(f"Trip {trip_id}: no more candidates after cascade, notifying passenger")
        channel_layer = get_channel_layer()
        async_to_sync(channel_layer.group_send)(
            f"dispatch_{trip_id}",
            {
                "type": "dispatch_update",
                "data": {
                    "trip_id": trip_id,
                    "status": TRIP_STATUS_CANCELLED,
                    "reason": "no_drivers_available",
                },
            },
        )


@shared_task
def expire_broadcast_request(request_id):
    """
    Expires a broadcast dispatch request after timeout (45s).
    Re-dispatches with expanded radius using hybrid approach:
    1. Try NEW drivers within 5km (exclude previously notified).
    2. If no new drivers, fall back to ALL available drivers.
    3. If still none, notify passenger no drivers available.
    """
    from operations.models import DispatchRequest
    from operations.services.dispatch_service import DispatchService
    from asgiref.sync import async_to_sync
    from channels.layers import get_channel_layer

    try:
        dispatch_request = DispatchRequest.objects.get(id=request_id)

        if dispatch_request.status != DispatchRequest.STATUS_PENDING:
            return

        dispatch_request.status = DispatchRequest.STATUS_EXPIRED
        dispatch_request.save()

        channel_layer = get_channel_layer()
        notified = set(dispatch_request.notified_drivers)

        # Stage 1: Try NEW drivers within 5km (exclude previously notified)
        candidates = DispatchService.find_best_candidates(
            str(dispatch_request.route_id),
            str(dispatch_request.pickup_stop_id),
            limit=5,
            exclude_drivers=notified,
        )

        if candidates:
            # Re-broadcast to new drivers only
            DispatchService._handle_broadcast_dispatch(
                dispatch_request.passenger,
                str(dispatch_request.route_id),
                str(dispatch_request.pickup_stop_id),
                str(dispatch_request.drop_stop_id) if dispatch_request.drop_stop else None,
                candidates,
            )
            logger.info(f"Broadcast {request_id}: re-dispatched to {len(candidates)} new drivers")
            return

        # Stage 2: No new drivers — fall back to ALL available drivers
        all_candidates = DispatchService.find_best_candidates(
            str(dispatch_request.route_id),
            str(dispatch_request.pickup_stop_id),
            limit=5,
        )

        if all_candidates:
            DispatchService._handle_broadcast_dispatch(
                dispatch_request.passenger,
                str(dispatch_request.route_id),
                str(dispatch_request.pickup_stop_id),
                str(dispatch_request.drop_stop_id) if dispatch_request.drop_stop else None,
                all_candidates,
            )
            logger.info(f"Broadcast {request_id}: re-dispatched to {len(all_candidates)} drivers (fallback)")
            return

        # Stage 3: No drivers available anywhere
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
        logger.info(f"Broadcast {request_id}: expired, no drivers available")

    except DispatchRequest.DoesNotExist:
        logger.warning(f"Broadcast dispatch {request_id} not found for expiry")
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
