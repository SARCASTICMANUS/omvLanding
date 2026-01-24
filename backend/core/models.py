from django.contrib.gis.db import models
from django.contrib.auth.models import User
import uuid


class Route(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    # The calculated road path from A to G
    path = models.LineStringField(geography=True)
    start_name = models.CharField(max_length=255)
    end_name = models.CharField(max_length=255)
    total_distance_meters = models.FloatField()
    created_at = models.DateTimeField(auto_now_add=True)


class ActiveTrip(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    route = models.ForeignKey(Route, on_delete=models.CASCADE)
    vehicle_type = models.CharField(
        max_length=50, choices=[("car", "Car"), ("bus", "Bus"), ("bike", "Bike")]
    )
    driver_socket_id = models.CharField(max_length=255, null=True)
    is_active = models.BooleanField(default=True)
