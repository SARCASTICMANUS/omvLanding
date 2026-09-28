import logging
from celery import shared_task
from django.contrib.auth import get_user_model
from communication.consumers.notification_consumer import (
    NotificationConsumer,
    PermanentDeliveryError,
)
from communication.services.email_service import EmailService
from common.constants import NOTIFICATION_SENT

User = get_user_model()

logger = logging.getLogger(__name__)


@shared_task(
    bind=True,
    max_retries=5,
    default_retry_delay=60,
    acks_late=True,
    queue="notifications"
)
def send_notification(self, payload):
    """
    Celery task to deliver notifications.
    Uses exponential backoff for retries.
    """
    notification_id = (payload or {}).get("notification_id")
    try:
        NotificationConsumer.handle_delivery(payload)
    except PermanentDeliveryError as exc:
        # Terminal by definition (no push token, unregistered device, 4xx).
        # Retrying only delays the same failed outcome, so record it now.
        logger.error(
            "Permanent delivery failure for notification %s: %s", notification_id, exc
        )
        _mark_notification_failed(notification_id, str(exc))
        return
    except Exception as exc:
        retries = self.request.retries
        if retries >= self.max_retries:
            # Retries are exhausted. Previously the exception propagated with the
            # row still in 'pending', so it sat there forever and there was no
            # signal that delivery had definitively failed.
            logger.error(
                "Giving up on notification %s after %d retries: %s",
                notification_id, retries + 1, exc,
            )
            _mark_notification_failed(notification_id, str(exc))
            # Swallow: the work is finished, just unsuccessfully. Re-raising here
            # would only produce a duplicate failure log from the worker.
            return
        logger.warning(
            "Delivery error for notification %s (attempt %d/%d): %s",
            notification_id, retries + 1, self.max_retries, exc,
        )
        # Exponential backoff: 1min, 2min, 4min, 8min, 16min
        retry_delay = 60 * (2 ** retries)
        raise self.retry(exc=exc, countdown=retry_delay)


def _mark_notification_failed(notification_id, error):
    """
    Terminal failure transition, best effort.

    Runs after the last retry, so it must not itself raise: an exception here
    would mask the real cause and leave the row pending.
    """
    if not notification_id:
        return
    try:
        from communication.models import Notification
        from communication.services.notification_service import NotificationService

        notification = Notification.objects.filter(id=notification_id).first()
        if notification is None:
            logger.error("Cannot mark notification %s failed: row not found", notification_id)
            return
        if notification.status == NOTIFICATION_SENT:
            return
        NotificationService.mark_failed(notification)
        metadata = dict(notification.metadata or {})
        metadata["last_delivery_error"] = (error or "")[:500]
        notification.metadata = metadata
        notification.save(update_fields=["metadata"])
    except Exception as exc:
        logger.error(
            "Failed to record terminal failure for notification %s: %s",
            notification_id, exc,
        )


@shared_task(queue="notifications")
def send_otp_task(user_id, otp):
    try:
        user = User.objects.get(id=user_id)
        subject = "Your VAYY Safety Code"
        message = f"Your Safety Code for VAYY account verification is: {otp}. It expires in 10 minutes."
        EmailService.send(subject, message, user.email)
    except User.DoesNotExist:
        logger.error(f"User {user_id} not found for OTP sending")
    except Exception as e:
        logger.exception(f"Failed to send OTP to user {user_id}: {e}")


@shared_task(queue="notifications")
def send_password_reset_otp_task(user_id, otp):
    try:
        user = User.objects.get(id=user_id)
        subject = "Your VAYY Password Reset Code"
        message = f"Your Safety Code for password reset is: {otp}. It expires in 10 minutes."
        EmailService.send(subject, message, user.email)
    except User.DoesNotExist:
        logger.error(f"User {user_id} not found for password reset OTP")
    except Exception as e:
        logger.exception(f"Failed to send password reset OTP to user {user_id}: {e}")


@shared_task(queue="notifications")
def send_registration_otp_task(email, otp):
    try:
        subject = "Your VAYY Safety Code"
        message = f"Your Safety Code for VAYY account verification is: {otp}. It expires in 10 minutes."
        EmailService.send(subject, message, email)
    except Exception as e:
        logger.exception(f"Failed to send registration OTP to {email}: {e}")
