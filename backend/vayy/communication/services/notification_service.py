import logging
from django.utils import timezone
from typing import Dict, Any, Optional
from asgiref.sync import async_to_sync
from channels.layers import get_channel_layer

from communication.models import Notification
from common.constants import (
    NOTIFICATION_SENT,
    NOTIFICATION_FAILED,
    NOTIFICATION_PUSH,
    NOTIFICATION_SMS,
    NOTIFICATION_EMAIL,
    EXCHANGE_NOTIFICATION,
    RK_NOTIFICATION_SMS,
    RK_NOTIFICATION_EMAIL,
    RK_NOTIFICATION_PUSH
)
from communication.services.rabbitmq_service import RabbitMQService

logger = logging.getLogger(__name__)


class NotificationService:
    """
    Handles the creation and delivery lifecycle of notifications.
    """

    @staticmethod
    def _notify_ws(group_name: str, event_type: str, data: Dict[str, Any]):
        channel_layer = get_channel_layer()
        async_to_sync(channel_layer.group_send)(
            group_name,
            {
                "type": event_type,
                "data": data
            }
        )

    @staticmethod
    def create(
        user,
        title: str,
        message: str,
        notification_type: str = NOTIFICATION_PUSH,
        metadata: Optional[Dict[str, Any]] = None,
    ) -> Notification:
        """
        Creates a notification record and publishes a delivery event.
        """
        notification = Notification.objects.create(
            user=user,
            title=title,
            message=message,
            notification_type=notification_type,
            metadata=metadata or {},
        )

        # 1. Broadcast to WebSockets immediately for in-app experience
        ws_payload = {
            "id": str(notification.id),
            "title": title,
            "message": message,
            "type": notification_type,
            "metadata": notification.metadata,
            "created_at": notification.created_at.isoformat()
        }
        NotificationService._notify_ws(f"notifications_{user.id}", "notification_broadcast", ws_payload)

        # 2. Publish to RabbitMQ for external delivery (SMS, Email, Push)
        routing_key = RK_NOTIFICATION_PUSH
        if notification_type == NOTIFICATION_SMS:
            routing_key = RK_NOTIFICATION_SMS
        elif notification_type == NOTIFICATION_EMAIL:
            routing_key = RK_NOTIFICATION_EMAIL

        try:
            RabbitMQService.publish(
                exchange=EXCHANGE_NOTIFICATION,
                routing_key=routing_key,
                payload={
                    "notification_id": str(notification.id),
                    "user_id": str(user.id),
                    "type": notification_type
                }
            )
            logger.info(f"Published notification {notification.id} to {routing_key}")
        except Exception as e:
            logger.error(f"Failed to publish notification event: {e}")
            # Notification remains in 'pending' status in DB

        return notification

    @staticmethod
    def mark_sent(notification: Notification) -> Notification:
        """
        Marks a notification as sent.
        """
        notification.status = NOTIFICATION_SENT
        notification.sent_at = timezone.now()
        notification.save(update_fields=["status", "sent_at"])
        logger.info(f"Notification {notification.id} marked as sent")
        return notification

    @staticmethod
    def mark_failed(notification: Notification) -> Notification:
        """
        Marks a notification as failed.
        """
        notification.status = NOTIFICATION_FAILED
        notification.save(update_fields=["status"])
        logger.error(f"Notification {notification.id} marked as failed")
        return notification