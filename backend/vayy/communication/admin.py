from django.contrib import admin

from communication.models import (
    Notification,
    NotificationPreference,
    WaitlistEntry,
)


admin.site.register(
    Notification
)

admin.site.register(
    NotificationPreference
)

admin.site.register(
    WaitlistEntry
)