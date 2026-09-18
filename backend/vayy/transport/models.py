import uuid

from django.db import models
from django.contrib.gis.db import models as gis_models

from common.constants import ROUTE_PUBLIC


class City(models.Model):
    id = models.UUIDField(
        primary_key=True,
        default=uuid.uuid4,
        editable=False,
    )
    name = models.CharField(
        max_length=255,
    )
    state = models.CharField(
        max_length=255,
        blank=True,
        default="",
    )
    country = models.CharField(
        max_length=255,
        default="India",
    )
    location = gis_models.PointField(
        geography=True,
        null=True,
        blank=True,
    )
    created_at = models.DateTimeField(
        auto_now_add=True,
    )
    class Meta:
        ordering = ["name"]

    def __str__(self):
        return f"{self.name}, {self.state}"
    

class Route(models.Model):
    id = models.UUIDField(
        primary_key=True,
        default=uuid.uuid4,
        editable=False,
    )

    city = models.ForeignKey(
        City,
        related_name="routes",
        on_delete=models.CASCADE,
    )

    name = models.CharField(
        max_length=255,
    )

    route_code = models.CharField(
        max_length=50,
        blank=True,
        default="",
    )

    path = gis_models.LineStringField(
        geography=True,
    )

    start_name = models.CharField(
        max_length=255,
        blank=True,
        default="",
    )

    end_name = models.CharField(
        max_length=255,
        blank=True,
        default="",
    )

    total_distance_meters = models.FloatField(
        default=0,
    )

    is_public = models.BooleanField(
        default=True,
    )

    created_at = models.DateTimeField(
        auto_now_add=True,
    )

    updated_at = models.DateTimeField(
        auto_now=True,
    )

    def __str__(self):
        return self.name
    

class Stop(models.Model):
    id = models.UUIDField(
        primary_key=True,
        default=uuid.uuid4,
        editable=False,
    )

    route = models.ForeignKey(
        Route,
        related_name="stops",
        on_delete=models.CASCADE,
    )

    name = models.CharField(
        max_length=255,
    )

    location = gis_models.PointField(
        geography=True,
    )

    order = models.PositiveIntegerField()

    geometry = gis_models.LineStringField(
        geography=True,
        null=True,
        blank=True,
        help_text="Road segment from this stop to the next stop (OSRM snapped).",
    )

    cumulative_distance_m = models.FloatField(
        default=0,
        help_text="Cumulative distance from the first stop to this stop along the route.",
    )

    cumulative_duration_s = models.FloatField(
        default=0,
        help_text="Cumulative travel time from the first stop to this stop along the route.",
    )

    plus_code = models.CharField(
        max_length=100,
        blank=True,
        help_text="Plus code (e.g. PVJ3+Q55 Lucknow)",
    )

    nearby_landmark = models.CharField(
        max_length=255,
        blank=True,
        help_text="Nearby landmark name",
    )

    class Meta:
        ordering = ["order"]
        unique_together = [("route", "order")]

    def __str__(self):
        return self.name
    
class TripSchedule(models.Model):
    id = models.UUIDField(
        primary_key=True,
        default=uuid.uuid4,
        editable=False,
    )

    route = models.ForeignKey(
        Route,
        related_name="schedules",
        on_delete=models.CASCADE,
    )

    scheduled_start_time = models.TimeField()

    label = models.CharField(
        max_length=100,
    )

    is_active = models.BooleanField(
        default=True,
    )

    def __str__(self):
        return f"{self.route.name} - {self.label}"
    
class StopTime(models.Model):
    id = models.UUIDField(
        primary_key=True,
        default=uuid.uuid4,
        editable=False,
    )

    trip_schedule = models.ForeignKey(
        TripSchedule,
        related_name="stop_times",
        on_delete=models.CASCADE,
    )

    stop = models.ForeignKey(
        Stop,
        on_delete=models.CASCADE,
    )

    arrival_time = models.TimeField()

    stop_sequence = models.PositiveIntegerField()

    class Meta:
        ordering = ["stop_sequence"]

    def __str__(self):
        return (
            f"{self.stop.name} - "
            f"{self.arrival_time}"
        )


