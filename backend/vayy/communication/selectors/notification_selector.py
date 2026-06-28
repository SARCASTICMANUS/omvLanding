from communication.models import Notification


class NotificationSelector:

    @staticmethod
    def list_user_notifications(
        user_id,
    ):
        return (
            Notification.objects
            .filter(user_id=user_id)
            .order_by("-created_at")
        )

    @staticmethod
    def unread_notifications(
        user_id,
    ):
        return (
            Notification.objects
            .filter(
                user_id=user_id,
                read=False,
            )
        )

    @staticmethod
    def get_notification(
        notification_id,
    ):
        return (
            Notification.objects
            .get(id=notification_id)
        )