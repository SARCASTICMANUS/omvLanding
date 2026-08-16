from rest_framework import serializers

from communication.models import (
    Notification,
    NotificationPreference,
    WaitlistEntry,
)


class NotificationSerializer(
    serializers.ModelSerializer
):
    class Meta:
        model = Notification
        fields = (
            "id",
            "user",
            "title",
            "message",
            "notification_type",
            "status",
            "metadata",
            "read",
            "created_at",
            "sent_at",
        )


class NotificationPreferenceSerializer(serializers.ModelSerializer):
    class Meta:
        model = NotificationPreference
        fields = (
            "email_enabled",
            "sms_enabled",
            "push_enabled",
            "trip_updates",
            "boarding_updates",
            "dispatch_alerts",
            "marketing_updates",
        )


class WaitlistSerializer(serializers.ModelSerializer):
    class Meta:
        model = WaitlistEntry
        fields = ("email",)