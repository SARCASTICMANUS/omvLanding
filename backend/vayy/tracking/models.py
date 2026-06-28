import uuid
from django.db import models
from django.utils import timezone
from django.contrib.gis.db import models as gis_models

from accounts.models import User
from operations.models import Vehicle, ActiveTrip


class HybridLog(models.Model):
    """
    Raw multi-source location ingestion:
    - GPS
    - Cell towers
    - WiFi APs
    """

    id = models.UUIDField(
        primary_key=True,
        default=uuid.uuid4,
        editable=False,
    )

    user = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name="tracking_logs",
    )

    vehicle = models.ForeignKey(
        Vehicle,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
    )

    trip = models.ForeignKey(
        ActiveTrip,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
    )

    location = gis_models.PointField(
        geography=True,
        null=True,
        blank=True,
    )

    speed = models.FloatField(default=0)
    heading = models.FloatField(default=0)

    cell_towers = models.JSONField(default=list, blank=True)
    wifi_aps = models.JSONField(default=list, blank=True)

    device_id = models.CharField(
        max_length=255,
        db_index=True,
        null=True,
        blank=True,
    )

    timestamp = models.DateTimeField(
        default=timezone.now,
        db_index=True,
    )

    created_at = models.DateTimeField(
        auto_now_add=True,
    )

    class Meta:
        ordering = ["-timestamp"]
        indexes = [
            models.Index(fields=["vehicle", "timestamp"]),
            models.Index(fields=["trip", "timestamp"]),
        ]

    def __str__(self):
        return f"{self.vehicle} @ {self.timestamp}"