from django.contrib.auth.models import AbstractUser
from django.db import models
from django.contrib.gis.db import models as gis_models
from django.contrib.auth import get_user_model
import uuid


class University(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=255)
    location = gis_models.PointField(geography=True, null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return self.name


class User(AbstractUser):
    ROLE_CHOICES = (
        ("student", "Student"),
        ("passenger", "Passenger"),
        ("driver", "Driver"),
        ("university_admin", "University Admin"),
        ("admin", "Admin"),
    )
    VEHICLE_CHOICES = (
        ("car", "Car"),
        ("bus", "Bus"),
        ("bike", "Bike"),
        ("auto", "Auto"),
    )

    email = models.EmailField(unique=True)
    role = models.CharField(max_length=20, choices=ROLE_CHOICES, default="passenger")
    university = models.ForeignKey(
        University, on_delete=models.SET_NULL, null=True, blank=True
    )

    # Driver specific (legacy/backup)
    vehicle_type = models.CharField(
        max_length=20, choices=VEHICLE_CHOICES, null=True, blank=True
    )
    vehicle_number = models.CharField(max_length=20, null=True, blank=True)

    # OTP Verification
    otp = models.CharField(max_length=6, null=True, blank=True)
    is_verified = models.BooleanField(default=False)

    USERNAME_FIELD = "email"
    REQUIRED_FIELDS = ["username"]


User_model = get_user_model()


class Route(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    university = models.ForeignKey(
        University, on_delete=models.CASCADE, related_name="routes"
    )
    name = models.CharField(max_length=255)
    path = gis_models.LineStringField(geography=True)
    start_name = models.CharField(max_length=255)
    end_name = models.CharField(max_length=255)
    total_distance_meters = models.FloatField()
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.name} ({self.university.name})"


class Stop(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    route = models.ForeignKey(Route, on_delete=models.CASCADE, related_name="stops")
    name = models.CharField(max_length=255)
    location = gis_models.PointField(geography=True)
    order = models.PositiveIntegerField()

    class Meta:
        ordering = ["order"]

    def __str__(self):
        return f"{self.name} - {self.route.name}"


class Vehicle(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    university = models.ForeignKey(
        University, on_delete=models.CASCADE, related_name="vehicles"
    )
    route = models.ForeignKey(
        Route, on_delete=models.SET_NULL, null=True, related_name="vehicles"
    )
    driver = models.OneToOneField(
        User_model,
        on_delete=models.SET_NULL,
        null=True,
        related_name="assigned_vehicle",
    )
    vehicle_number = models.CharField(max_length=50)
    vehicle_type = models.CharField(
        max_length=20, choices=User.VEHICLE_CHOICES, default="bus"
    )

    def __str__(self):
        return f"{self.vehicle_number} ({self.university.name})"


class StudentAssignment(models.Model):
    student = models.ForeignKey(
        User_model, on_delete=models.CASCADE, related_name="vehicle_assignments"
    )
    vehicle = models.ForeignKey(
        Vehicle, on_delete=models.CASCADE, related_name="assigned_students"
    )
    assigned_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ("student", "vehicle")


class ActiveTrip(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    # Linking to Vehicle now instead of raw route
    vehicle = models.ForeignKey(Vehicle, on_delete=models.CASCADE, null=True)
    route = models.ForeignKey(Route, on_delete=models.CASCADE)
    driver = models.ForeignKey(
        User_model,
        on_delete=models.CASCADE,
        related_name="trips",
        null=True,
    )
    is_active = models.BooleanField(default=True)
    start_time = models.DateTimeField(auto_now_add=True)
