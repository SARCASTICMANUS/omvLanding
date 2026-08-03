import logging
from rest_framework import status
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import (
    IsAuthenticated,
)

from communication.selectors.notification_selector import (
    NotificationSelector,
)

from communication.api.serializers import (
    NotificationSerializer,
    NotificationPreferenceSerializer,
)
from communication.models import Notification, NotificationPreference

logger = logging.getLogger(__name__)

class NotificationListAPIView(
    APIView
):
    permission_classes = [
        IsAuthenticated
    ]

    def get(self, request):
        notifications = (
            NotificationSelector
            .list_user_notifications(
                request.user.id
            )
        )

        serializer = (
            NotificationSerializer(
                notifications,
                many=True,
            )
        )

        resp = Response({
            "success": True,
            "message": "Notifications fetched successfully",
            "data": serializer.data
        })
        return resp

class NotificationReadAPIView(APIView):
    """
    PATCH /api/notifications/{id}/read
    Marks a specific notification as read.
    """
    permission_classes = [IsAuthenticated]

    def patch(self, request, notification_id):
        try:
            notification = Notification.objects.get(id=notification_id, user=request.user)
            notification.read = True
            notification.save(update_fields=["read"])
            resp = Response({
                "success": True,
                "message": "Notification marked as read",
                "data": NotificationSerializer(notification).data
            })
            return resp
        except Notification.DoesNotExist:
            logger.warning(f"[NotificationRead] Notification {notification_id} not found for user {request.user.id}")
            return Response({"success": False, "message": "Notification not found"}, status=status.HTTP_404_NOT_FOUND)

class NotificationReadAllAPIView(APIView):
    """
    PATCH /api/notifications/read-all
    Marks all user notifications as read.
    """
    permission_classes = [IsAuthenticated]

    def patch(self, request):
        count = Notification.objects.filter(user=request.user, read=False).update(read=True)
        logger.info(f"[NotificationReadAll] Marked {count} notifications as read for user {request.user.id}")
        resp = Response({
            "success": True,
            "message": "All notifications marked as read",
            "data": {}
        })
        return resp

class NotificationDeleteAPIView(APIView):
    """
    DELETE /api/notifications/{id}
    Deletes a specific notification.
    """
    permission_classes = [IsAuthenticated]

    def delete(self, request, notification_id):
        try:
            notification = Notification.objects.get(id=notification_id, user=request.user)
            notification.delete()
            logger.info(f"[NotificationDelete] Deleted notification {notification_id} for user {request.user.id}")
            resp = Response({
                "success": True,
                "message": "Notification deleted",
                "data": {}
            })
            return resp
        except Notification.DoesNotExist:
            logger.warning(f"[NotificationDelete] Notification {notification_id} not found for user {request.user.id}")
            return Response({"success": False, "message": "Notification not found"}, status=status.HTTP_404_NOT_FOUND)

class NotificationPreferenceAPIView(APIView):
    """
    GET/PATCH /api/notification-preferences
    Manages user notification preferences.
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        pref, _ = NotificationPreference.objects.get_or_create(user=request.user)
        resp = Response({
            "success": True,
            "message": "Preferences fetched",
            "data": NotificationPreferenceSerializer(pref).data
        })
        return resp

    def patch(self, request):
        pref, _ = NotificationPreference.objects.get_or_create(user=request.user)
        serializer = NotificationPreferenceSerializer(pref, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        resp = Response({
            "success": True,
            "message": "Preferences updated",
            "data": serializer.data
        })
        return resp
