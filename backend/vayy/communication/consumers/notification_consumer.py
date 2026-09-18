import logging
from typing import Dict, Any

from communication.models import Notification
from communication.services.notification_service import NotificationService
from communication.services.sms_service import SMSService
from communication.services.email_service import EmailService
from communication.services.push_service import PushService
from common.constants import (
    NOTIFICATION_SENT,
    NOTIFICATION_SMS,
    NOTIFICATION_EMAIL,
    NOTIFICATION_PUSH,
)

logger = logging.getLogger(__name__)


class NotificationConsumer:
    """
    Handles notification delivery events from RabbitMQ.
    """

    @staticmethod
    def handle_delivery(payload: Dict[str, Any]):
        """
        Processes a notification delivery request.
        """
        notification_id = payload.get("notification_id")
        logger.info(f"Processing delivery for notification: {notification_id}")
        
        try:
            notification = Notification.objects.get(id=notification_id)
            
            # Idempotency check
            if notification.status == NOTIFICATION_SENT:
                logger.info(f"Notification {notification_id} already sent, skipping.")
                return

            # Route to specific delivery service
            success = False
            if notification.notification_type == NOTIFICATION_SMS:
                phone = (
                    getattr(getattr(notification.user, 'passenger_profile', None), 'phone_number', None)
                    or getattr(getattr(notification.user, 'driver_profile', None), 'phone_number', '')
                )
                success = SMSService.send(phone, notification.message)
            elif notification.notification_type == NOTIFICATION_EMAIL:
                success = EmailService.send(notification.title, notification.message, notification.user.email)
            elif notification.notification_type == NOTIFICATION_PUSH:
                success = PushService.send(notification.user, notification.title, notification.message)
            else:
                logger.error(f"Unsupported notification type: {notification.notification_type}")
                NotificationService.mark_failed(notification)
                return

            if success:
                NotificationService.mark_sent(notification)
            else:
                logger.error(f"Delivery failed for notification {notification_id}")
                # We raise an exception to trigger Celery retry
                raise Exception("Delivery service failed")

        except Notification.DoesNotExist:
            logger.error(f"Notification {notification_id} not found")
        except Exception as e:
            logger.exception(f"Unexpected error in NotificationConsumer: {e}")
            raise
