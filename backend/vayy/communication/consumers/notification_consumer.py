import logging
from typing import Dict, Any

from communication.models import Notification
from communication.services.notification_service import NotificationService
from communication.services.sms_service import SMSService
from communication.services.email_service import EmailService
from communication.services.push_service import PushService
from common.constants import (
    NOTIFICATION_SENT,
    NOTIFICATION_IN_APP,
    NOTIFICATION_SMS,
    NOTIFICATION_EMAIL,
    NOTIFICATION_PUSH,
)

logger = logging.getLogger(__name__)


class PermanentDeliveryError(Exception):
    """
    A delivery that retrying cannot fix: no push token registered, a device the
    provider reports as unregistered, or a 4xx rejection.

    The Celery task treats this as terminal and marks the notification failed
    immediately. Without this distinction a user who never registered a push
    token would burn the full retry ladder (~31 min of backoff) on every single
    notification before reaching the same failed state.
    """


class NotificationConsumer:
    """
    Performs the actual delivery for a notification.

    Invoked only from the send_notification Celery task, which in turn is
    invoked only by the consume_notifications RabbitMQ consumer. Keeping the
    delivery in Celery means provider calls cannot block the AMQP consumer and
    retries get exponential backoff.
    """

    @staticmethod
    def handle_delivery(payload: Dict[str, Any]):
        notification_id = payload.get("notification_id")
        if not notification_id:
            logger.error("Delivery event has no notification_id: %s", payload)
            return

        logger.info("Processing delivery for notification: %s", notification_id)

        try:
            notification = Notification.objects.get(id=notification_id)
        except Notification.DoesNotExist:
            # Nothing to retry: the row is gone.
            logger.error("Notification %s not found; dropping delivery event", notification_id)
            return
        except Exception as exc:
            # DB unavailable: transient, let Celery retry.
            logger.exception("Could not load notification %s: %s", notification_id, exc)
            raise

        # Idempotency: a redelivered message (broker restart, consumer restart)
        # must not send a second copy.
        if notification.status == NOTIFICATION_SENT:
            logger.info("Notification %s already sent, skipping.", notification_id)
            return

        # in_app is delivered over WebSocket inside NotificationService.create,
        # before this event is even published. There is no external channel to
        # fire, so it is already delivered. This used to fall through to the
        # unsupported-type branch and mark in-app notifications FAILED.
        if notification.notification_type == NOTIFICATION_IN_APP:
            NotificationService.mark_sent(notification)
            return

        try:
            success = NotificationConsumer._deliver(notification)
        except Exception as exc:
            NotificationConsumer._record_attempt(notification, delivered=False, error=exc)
            # Transient (provider timeout, DB blip): raise so the Celery task
            # retries with exponential backoff.
            logger.warning(
                "Delivery attempt raised for notification %s: %s", notification_id, exc
            )
            raise

        if success:
            NotificationService.mark_sent(notification)
        else:
            # Permanent failure (no push token, unregistered device, 4xx).
            # Record it and stop: retrying cannot fix these.
            NotificationConsumer._record_attempt(
                notification, delivered=False, error="delivery service rejected the message"
            )
            logger.error("Delivery failed for notification %s", notification_id)
            raise PermanentDeliveryError(
                f"Delivery failed for notification {notification_id}"
            )

    @staticmethod
    def _deliver(notification: Notification) -> bool:
        if notification.notification_type == NOTIFICATION_SMS:
            phone = (
                getattr(getattr(notification.user, "passenger_profile", None), "phone_number", None)
                or getattr(getattr(notification.user, "driver_profile", None), "phone_number", "")
            )
            return SMSService.send(phone, notification.message)

        if notification.notification_type == NOTIFICATION_EMAIL:
            return EmailService.send(
                notification.title, notification.message, notification.user.email
            )

        if notification.notification_type == NOTIFICATION_PUSH:
            return PushService.send(
                notification.user,
                notification.title,
                notification.message,
                data=notification.metadata or None,
            )

        logger.error("Unsupported notification type: %s", notification.notification_type)
        NotificationService.mark_failed(notification)
        return False

    @staticmethod
    def _record_attempt(notification: Notification, delivered: bool, error=None):
        """
        Track delivery attempts in metadata.

        metadata is a JSONField, so this needs no schema change and therefore no
        migration. Keeps the failure reason visible on the row instead of only in
        the logs.
        """
        try:
            metadata = dict(notification.metadata or {})
            attempts = int(metadata.get("delivery_attempts", 0)) + 1
            metadata["delivery_attempts"] = attempts
            metadata["last_delivery_error"] = str(error)[:500] if error else None
            notification.metadata = metadata
            notification.save(update_fields=["metadata"])
        except Exception as exc:  # pragma: no cover - never mask the real error
            logger.warning("Could not record delivery attempt: %s", exc)
