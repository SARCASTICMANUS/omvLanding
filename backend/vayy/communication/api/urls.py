from django.urls import path

from communication.api.views import (
    NotificationListAPIView,
    NotificationReadAPIView,
    NotificationReadAllAPIView,
    NotificationDeleteAPIView,
    NotificationPreferenceAPIView,
    WaitlistCreateAPIView,
)

urlpatterns = [
    path(
        "waitlist/",
        WaitlistCreateAPIView.as_view(),
        name="waitlist-create",
    ),
    path(
        "notifications/",
        NotificationListAPIView.as_view(),
        name="notification-list",
    ),
    path(
        "notifications/read-all/",
        NotificationReadAllAPIView.as_view(),
        name="notification-read-all",
    ),
    path(
        "notifications/<uuid:notification_id>/read/",
        NotificationReadAPIView.as_view(),
        name="notification-read",
    ),
    path(
        "notifications/<uuid:notification_id>/",
        NotificationDeleteAPIView.as_view(),
        name="notification-delete",
    ),
    path(
        "preferences/",
        NotificationPreferenceAPIView.as_view(),
        name="notification-preferences",
    ),
]