import uuid

from django.db import models
from django.contrib.gis.db import models as gis_models

from transport.constants import ROUTE_PUBLIC


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

    bus_number = models.CharField(
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

    class Meta:
        ordering = ["order"]

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