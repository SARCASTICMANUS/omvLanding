import logging
import random

from celery import shared_task
from django.db import transaction
from django.utils import timezone
from datetime import timedelta
from operations.models import ActiveTrip, BoardingRequest
from operations.consumers.dispatch_consumer import DispatchConsumer
from common.constants import (
    TRIP_STATUS_ASSIGNED, TRIP_STATUS_CANCELLED, TRIP_STATUS_REJECTED,
    TRIP_STATUS_COMPLETED, TRIP_STATUS_PARTIALLY_SETTLED, BOARDING_BOARDED,
)

logger = logging.getLogger(__name__)

# Assignment/broadcast timeouts are latency-critical: a driver who never
# answers must be re-dispatched within seconds or the passenger is left
# waiting. They get their own queue so a slow task on the shared "celery"
# queue (pageview analytics, OTP mail, geocache warms) cannot head-of-line
# block the cascade.
DISPATCH_TIMEOUT_QUEUE = "dispatch_timeouts"

# OSRM's distance matrix is capped at a 10s HTTP timeout with a haversine
# fallback, so the ceiling here is one OSRM round trip plus DB work and a
# websocket send. soft first so the task can unwind, hard as the backstop.
DISPATCH_TIMEOUT_SOFT_LIMIT = 25
DISPATCH_TIMEOUT_HARD_LIMIT = 30


@shared_task(
    queue=DISPATCH_TIMEOUT_QUEUE,
    soft_time_limit=DISPATCH_TIMEOUT_SOFT_LIMIT,
    time_limit=DISPATCH_TIMEOUT_HARD_LIMIT,
)
def check_assignment_timeout(trip_id):
    """
    Cascading timeout: if trip still ASSIGNED after 10s,
    reject current candidate and re-dispatch to next best.
    Cancel only after all candidates exhausted.

    The claim and the state change must be one atomic unit: without
    ``transaction.atomic`` the ``select_for_update`` below raises
    TransactionManagementError under autocommit, and two concurrent timeouts
    for the same trip could both read ASSIGNED and both cascade. The lock is
    deliberately released before the OSRM lookup and websocket send - holding
    a row lock across network I/O is how a dispatch deadlock starts.
    """
    from operations.services.dispatch_service import DispatchService
    from asgiref.sync import async_to_sync
    from channels.layers import get_channel_layer

    with transaction.atomic():
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

        # Capture everything the post-commit work needs while the row is
        # still locked, so the transaction stays a short read-modify-write.
        route_id = str(trip.route_id)
        pickup_stop_id = str(boarding.pickup_stop_id)
        drop_stop_id = str(boarding.drop_stop_id) if boarding.drop_stop else None
        excluded_driver_id = str(trip.driver_id)
        passenger = boarding.passenger

        # Mark current trip as rejected (driver timed out)
        trip.status = TRIP_STATUS_REJECTED
        trip.ended_at = timezone.now()
        trip.save()

    # --- lock released: slow work below must not run inside the transaction ---

    # Find next candidates excluding the timed-out driver
    candidates = DispatchService.find_best_candidates(
        route_id, pickup_stop_id, limit=5, exclude_drivers={excluded_driver_id}
    )

    if candidates:
        # Assign to next best candidate
        result = DispatchService._assign_to_driver(
            passenger=passenger,
            route_id=route_id,
            pickup_stop_id=pickup_stop_id,
            candidate=candidates[0],
            drop_stop_id=drop_stop_id,
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


BROADCAST_ROUND_SECONDS = 45
BROADCAST_ERROR_RETRY_SECONDS = 30


def _finalize_broadcast_expiry(dispatch_request_id: str) -> None:
    """
    Terminal outcome for a broadcast: mark it EXPIRED and tell the passenger.

    This is the ONLY place the cascade sets STATUS_EXPIRED, and it always
    notifies the passenger in the same call. That is what makes "stranded"
    impossible: a request can never be left in a terminal state with nobody
    told and no task pending, because the notification and the status change
    live together.

    Re-checks the status under a lock so a driver who accepts in the same
    window wins instead of being told the ride expired.
    """
    from operations.models import DispatchRequest
    from operations.services.dispatch_service import DispatchService
    from asgiref.sync import async_to_sync
    from channels.layers import get_channel_layer

    channel_layer = get_channel_layer()

    with transaction.atomic():
        try:
            dispatch_request = DispatchRequest.objects.select_for_update().get(
                id=dispatch_request_id
            )
        except DispatchRequest.DoesNotExist:
            return

        if dispatch_request.status != DispatchRequest.STATUS_PENDING:
            # Accepted or cancelled while this tick was in flight; the trip
            # already exists and the passenger already has a driver.
            logger.info(
                f"Broadcast {dispatch_request_id}: expiry skipped, "
                f"status={dispatch_request.status}"
            )
            return

        dispatch_request.status = DispatchRequest.STATUS_EXPIRED
        dispatch_request.save(update_fields=["status"])

        passenger_id = str(dispatch_request.passenger_id)
        notified = [str(d) for d in (dispatch_request.notified_drivers or [])]

    # --- lock released: websocket sends must not run under a row lock ---

    # Tell every driver still holding the popup to close it.
    for driver_id_str in notified:
        async_to_sync(channel_layer.group_send)(
            f"notifications_{driver_id_str}",
            {
                "type": "notification_broadcast",
                "data": {
                    "type": "request_expired",
                    "request_id": str(dispatch_request_id),
                },
            },
        )

    # Existing broadcast-group message, unchanged format: the passenger UI
    # already renders this.
    async_to_sync(channel_layer.group_send)(
        f"broadcast_{dispatch_request_id}",
        {
            "type": "broadcast_update",
            "data": {
                "type": "no_drivers_available",
                "request_id": str(dispatch_request_id),
            },
        },
    )

    # Terminal notice on the passenger's own channel. The broadcast group is
    # best-effort - the client only holds it if the socket survived every
    # re-dispatch - so without this the passenger can be left waiting with no
    # indication that the search is over.
    DispatchService._notify_ws(
        f"notifications_{passenger_id}",
        "notification_broadcast",
        {
            "type": "request_expired",
            "request_id": str(dispatch_request_id),
            "status": DispatchRequest.STATUS_EXPIRED,
            "reason": "no_drivers_available",
            "message": "No drivers were available for your ride request.",
        },
    )

    logger.warning(
        f"Broadcast {dispatch_request_id}: expired after "
        f"{dispatch_request.attempt_count} round(s), no drivers available"
    )


@shared_task(
    queue=DISPATCH_TIMEOUT_QUEUE,
    soft_time_limit=DISPATCH_TIMEOUT_SOFT_LIMIT,
    time_limit=DISPATCH_TIMEOUT_HARD_LIMIT,
)
def expire_broadcast_request(request_id):
    """
    Expires a broadcast dispatch request after timeout (45s), with a bounded
    cascade:
    1. Try NEW drivers within 5km (excluding everyone already notified and
       everyone who dismissed).
    2. If no new drivers, fall back to ALL available drivers except those who
       dismissed.
    3. If still none - or the round budget is spent - terminate: EXPIRED plus
       an explicit notification to the passenger.

    Every exit is terminal-explicit. The request stays PENDING for the whole
    cascade so drivers can still accept mid-flight (flipping it to EXPIRED up
    front, as this used to, made the ride unclaimable for the length of the
    two OSRM lookups), and EXPIRED is only ever set together with the
    passenger notification in ``_finalize_broadcast_expiry``.

    The round counter is persisted, so a request that keeps finding idle
    drivers can no longer re-notify them every 45s forever. Error retries draw
    on the same budget, so a persistently failing request also terminates
    instead of looping.
    """
    from operations.models import DispatchRequest
    from operations.services.dispatch_service import DispatchService

    # --- claim: lock, confirm still pending, spend one round ---
    with transaction.atomic():
        try:
            dispatch_request = DispatchRequest.objects.select_for_update().get(
                id=request_id
            )
        except DispatchRequest.DoesNotExist:
            logger.warning(f"Broadcast dispatch {request_id} not found for expiry")
            return

        if dispatch_request.status != DispatchRequest.STATUS_PENDING:
            # Accepted, cancelled, or already expired by a concurrent tick.
            return

        dispatch_request.attempt_count = (dispatch_request.attempt_count or 0) + 1
        dispatch_request.save(update_fields=["attempt_count"])

        round_no = dispatch_request.attempt_count
        max_rounds = dispatch_request.max_rounds or 3
        notified = {str(d) for d in (dispatch_request.notified_drivers or [])}
        dismissed = {str(d) for d in (dispatch_request.dismissed_drivers or [])}
        # A journey-scoped request has no route; its candidates come from the
        # journeys passing the pickup stop instead.
        route_id = str(dispatch_request.route_id) if dispatch_request.route_id else None
        pickup_stop_id = str(dispatch_request.pickup_stop_id)
        drop_stop_id = str(dispatch_request.drop_stop_id) if dispatch_request.drop_stop else None

    # --- lock released: OSRM lookups and websocket sends below ---

    if round_no >= max_rounds:
        logger.info(
            f"Broadcast {request_id}: round budget spent "
            f"({round_no}/{max_rounds}), terminating"
        )
        _finalize_broadcast_expiry(request_id)
        return

    try:
        find_candidates = (
            (lambda exclude: DispatchService.find_best_candidates(
                route_id, pickup_stop_id, limit=5, exclude_drivers=exclude,
            ))
            if route_id
            else (lambda exclude: DispatchService.find_candidates_for_stop(
                pickup_stop_id, limit=5, exclude_drivers=exclude,
            ))
        )

        # Stage 1: NEW drivers - skip everyone already pinged and everyone who
        # dismissed.
        candidates = find_candidates(notified | dismissed)

        stage = "new"
        if not candidates:
            # Stage 2: fall back to ALL available drivers, minus the ones who
            # dismissed. This stage used to pass no exclusion at all, which is
            # what re-notified dismissive drivers every 45s.
            candidates = find_candidates(dismissed)
            stage = "fallback"

        if candidates:
            # Reuses the same request_id, so the passenger's broadcast WS group
            # stays valid, and schedules the next 45s tick.
            DispatchService._handle_broadcast_dispatch(
                dispatch_request.passenger,
                route_id,
                pickup_stop_id,
                drop_stop_id,
                candidates,
                dispatch_request=dispatch_request,
            )
            logger.info(
                f"Broadcast {request_id}: round {round_no}/{max_rounds} "
                f"re-dispatched to {len(candidates)} driver(s) ({stage})"
            )
            return

    except Exception:
        # An OSRM/Redis/DB fault must not strand the request: it is still
        # PENDING, nothing is scheduled, and the passenger would wait forever.
        # Re-queue a retry. The retry spends another round, so the budget above
        # guarantees this cannot loop indefinitely - once it is exhausted the
        # retry lands on the terminal path and the passenger is told.
        logger.exception(
            f"Broadcast {request_id}: cascade round {round_no}/{max_rounds} failed, "
            f"re-queueing in {BROADCAST_ERROR_RETRY_SECONDS}s"
        )
        expire_broadcast_request.apply_async(
            (str(request_id),),
            countdown=BROADCAST_ERROR_RETRY_SECONDS,
        )
        return

    # No candidates in either stage.
    _finalize_broadcast_expiry(request_id)


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
        route_id = str(trip.route_id) if trip.route_id else None

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

        # A journey has no route, so there is no route_passengers group to tell.
        # Its drivers hear about boardings through the trip's own socket, which
        # they already hold.
        if route_id:
            async_to_sync(channel_layer.group_send)(
                f"route_passengers_{route_id}",
                ws_payload,
            )

        logger.info(f"Boarding event processed: {event_type} for passenger {passenger_id} on route {route_id or 'journey'}")

    except ActiveTrip.DoesNotExist:
        logger.error(f"Trip not found for boarding event: {trip_id}")
    except Exception as exc:
        logger.error(f"Error processing boarding event: {exc}")
        raise self.retry(exc=exc)


# Settlement retries are financial work, not request handling: give them a long
# budget so a passenger topping up their wallet has time to do it.
SETTLEMENT_MAX_RETRIES = 8
SETTLEMENT_BASE_COUNTDOWN = 60
SETTLEMENT_MAX_COUNTDOWN = 3600


def _settlement_countdown(retries: int) -> int:
    """Exponential backoff with jitter: 60s, 120s, 240s ... capped at 1h."""
    delay = min(SETTLEMENT_BASE_COUNTDOWN * (2 ** retries), SETTLEMENT_MAX_COUNTDOWN)
    return delay + random.randint(0, max(1, delay // 10))


class IncompleteSettlement(Exception):
    """Raised internally to drive self.retry() while debits are outstanding."""


@shared_task(
    bind=True,
    max_retries=SETTLEMENT_MAX_RETRIES,
    queue="dispatch",
)
def settle_trip_settlement(self, trip_id: str):
    """
    Re-drive settlement for a trip that could not be fully settled at
    completion time.

    Enqueued via ``transaction.on_commit`` by ``update_trip_status`` whenever a
    completion attempt leaves passenger debits outstanding. Re-running the
    normal COMPLETED path is safe: ``WalletService.settle_debit`` is idempotent
    on the per-passenger reference, so already-settled fares are skipped rather
    than charged twice.

    Stops retrying once the trip reaches ``completed``, is cancelled, or the
    retry budget is exhausted - in that last case the trip stays
    ``partially_settled``, which is the durable signal for ops to reconcile.
    """
    from operations.services.dispatch_service import DispatchService

    try:
        trip = ActiveTrip.objects.select_related("vehicle", "route", "driver").get(id=trip_id)
    except ActiveTrip.DoesNotExist:
        logger.warning("Settlement retry skipped: trip %s no longer exists", trip_id)
        return {"trip_id": trip_id, "status": "gone"}

    if trip.status not in (TRIP_STATUS_PARTIALLY_SETTLED, TRIP_STATUS_COMPLETED):
        logger.info(
            "Settlement retry skipped for trip %s: status is %s, nothing to settle",
            trip_id, trip.status,
        )
        return {"trip_id": trip_id, "status": "skipped", "trip_status": trip.status}

    still_boarded = BoardingRequest.objects.filter(
        trip_id=trip_id, status=BOARDING_BOARDED
    ).exists()

    if trip.status == TRIP_STATUS_COMPLETED and not still_boarded:
        return {"trip_id": trip_id, "status": "settled"}

    try:
        # schedule_settlement_retry=False: this task owns the retry scheduling,
        # otherwise every attempt would fan out another Celery message.
        trip = DispatchService.update_trip_status(
            trip_id, TRIP_STATUS_COMPLETED, schedule_settlement_retry=False
        )
    except Exception as exc:
        if self.request.retries >= self.max_retries:
            logger.exception(
                "Settlement retries exhausted for trip %s; it remains %s", trip_id, TRIP_STATUS_PARTIALLY_SETTLED
            )
            raise
        countdown = _settlement_countdown(self.request.retries)
        logger.warning(
            "Settlement retry %s/%s for trip %s failed (%s); retrying in %ss",
            self.request.retries + 1, self.max_retries, trip_id, exc, countdown,
        )
        raise self.retry(exc=exc, countdown=countdown)

    if trip.status == TRIP_STATUS_PARTIALLY_SETTLED:
        if self.request.retries >= self.max_retries:
            logger.error(
                "Settlement retries exhausted for trip %s with %s passenger(s) "
                "still boarded. Trip remains %s and needs manual reconciliation.",
                trip_id,
                BoardingRequest.objects.filter(trip_id=trip_id, status=BOARDING_BOARDED).count(),
                TRIP_STATUS_PARTIALLY_SETTLED,
            )
            return {"trip_id": trip_id, "status": "exhausted", "trip_status": trip.status}
        countdown = _settlement_countdown(self.request.retries)
        logger.info(
            "Trip %s still has outstanding settlement; retry %s/%s in %ss",
            trip_id, self.request.retries + 1, self.max_retries, countdown,
        )
        raise self.retry(exc=IncompleteSettlement(trip_id), countdown=countdown)

    logger.info("Settlement recovered for trip %s", trip_id)
    return {"trip_id": trip_id, "status": "settled"}
