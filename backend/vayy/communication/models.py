import uuid
from django.db import models
from accounts.models import User
from common.constants import (
    NOTIFICATION_TYPE_CHOICES,
    NOTIFICATION_STATUS_CHOICES,
    NOTIFICATION_PENDING,
)


class Notification(models.Model):
    id = models.UUIDField(
        primary_key=True,
        default=uuid.uuid4,
        editable=False,
    )

    user = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name="notifications",
    )

    title = models.CharField(
        max_length=255,
    )

    message = models.TextField()

    notification_type = models.CharField(
        max_length=20,
        choices=NOTIFICATION_TYPE_CHOICES,
        default="push",
    )

    status = models.CharField(
        max_length=20,
        choices=NOTIFICATION_STATUS_CHOICES,
        default=NOTIFICATION_PENDING,
    )

    metadata = models.JSONField(
        default=dict,
        blank=True,
    )

    read = models.BooleanField(
        default=False,
    )

    created_at = models.DateTimeField(
        auto_now_add=True,
    )

    sent_at = models.DateTimeField(
        null=True,
        blank=True,
    )

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return self.title


class NotificationPreference(models.Model):
    user = models.OneToOneField(
        User,
        on_delete=models.CASCADE,
        related_name="notification_preferences",
    )

    email_enabled = models.BooleanField(
        default=True,
    )

    sms_enabled = models.BooleanField(
        default=False,
    )

    push_enabled = models.BooleanField(
        default=True,
    )

    trip_updates = models.BooleanField(
        default=True,
    )

    boarding_updates = models.BooleanField(
        default=True,
    )

    dispatch_alerts = models.BooleanField(
        default=True,
    )

    marketing_updates = models.BooleanField(
        default=False,
    )

    def __str__(self):
        return self.user.email


class WaitlistEntry(models.Model):
    id = models.UUIDField(
        primary_key=True,
        default=uuid.uuid4,
        editable=False,
    )

    email = models.EmailField(
        max_length=255,
        unique=True,
    )

    created_at = models.DateTimeField(
        auto_now_add=True,
    )

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return self.email