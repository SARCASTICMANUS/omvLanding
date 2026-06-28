import logging
from celery import shared_task
from django.contrib.auth import get_user_model
from communication.consumers.notification_consumer import NotificationConsumer
from communication.services.email_service import EmailService

User = get_user_model()

logger = logging.getLogger(__name__)


@shared_task(
    bind=True,
    max_retries=5,
    default_retry_delay=60,
    queue="notifications"
)
def send_notification(self, payload):
    """
    Celery task to deliver notifications.
    Uses exponential backoff for retries.
    """
    try:
        NotificationConsumer.handle_delivery(payload)
    except Exception as exc:
        logger.error(f"Error delivering notification: {exc}")
        # Exponential backoff: 1min, 2min, 4min, 8min, 16min
        retry_delay = 60 * (2 ** self.request.retries)
        raise self.retry(exc=exc, countdown=retry_delay)


@shared_task(queue="notifications")
def send_otp_task(user_id, otp):
    try:
        user = User.objects.get(id=user_id)
        subject = "Your VAYY OTP Code"
        message = f"Your OTP for VAYY account verification is: {otp}. It expires in 10 minutes."
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
        message = f"Your OTP for password reset is: {otp}. It expires in 10 minutes."
        EmailService.send(subject, message, user.email)
    except User.DoesNotExist:
        logger.error(f"User {user_id} not found for password reset OTP")
    except Exception as e:
        logger.exception(f"Failed to send password reset OTP to user {user_id}: {e}")
