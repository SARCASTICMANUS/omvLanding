import logging

from django.core.mail import send_mail

logger = logging.getLogger(__name__)


class EmailService:
    """
    Transactional email via Django's configured email backend.

    The backend is the console backend under DEBUG and real SMTP otherwise
    (see vayy/settings.py).

    This previously returned None. NotificationConsumer treats a falsy return
    as a delivery failure and raises to trigger a Celery retry, so a single
    successful send was retried the full five times - mailing the user five
    copies - and then the notification was recorded as failed. It now returns a
    real boolean and lets SMTP errors propagate.
    """

    @staticmethod
    def send(subject, message, recipient) -> bool:
        if not recipient:
            logger.warning("No recipient available; cannot send email")
            return False

        # fail_silently=False: an SMTP failure raises, which the Celery task
        # converts into a retry rather than a false success.
        send_mail(
            subject,
            message,
            None,
            [recipient],
            fail_silently=False,
        )
        logger.info("Email dispatched to %s", recipient)
        return True
