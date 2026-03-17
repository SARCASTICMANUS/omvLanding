# VAYY | core/models.py | Status: 🔧 Fixed
# Reason: Added StudentProfile, DriverProfile, BulkUploadLog; fixed ActiveTrip schema;
#         added otp_verified/otp_created_at to User; added bus_number to Route.

from django.contrib.auth.models import AbstractUser
from django.db import models
from django.contrib.gis.db import models as gis_models
from django.contrib.auth import get_user_model
from django.utils import timezone
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
        ("driver", "Driver"),
        ("university_admin", "University Admin"),
        ("admin", "Admin"),
    )

    email = models.EmailField(unique=True)
    role = models.CharField(max_length=20, choices=ROLE_CHOICES, default="student")
    university = models.ForeignKey(
        University, on_delete=models.SET_NULL, null=True, blank=True
    )

    # OTP Verification
    otp = models.CharField(max_length=6, null=True, blank=True)
    otp_verified = models.BooleanField(default=False)
    otp_created_at = models.DateTimeField(null=True, blank=True)
    is_verified = models.BooleanField(default=False)  # kept for backward compat

    # Legacy driver fields (kept to avoid breaking existing code; real data in DriverProfile)
    vehicle_type = models.CharField(max_length=20, null=True, blank=True)
    vehicle_number = models.CharField(max_length=20, null=True, blank=True)

    USERNAME_FIELD = "email"
    REQUIRED_FIELDS = []  # Remove username from required fields

    def __str__(self):
        return self.email


User_model = get_user_model()


class Route(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    university = models.ForeignKey(
        University, on_delete=models.CASCADE, related_name="routes"
    )
    name = models.CharField(max_length=255)
    bus_number = models.CharField(max_length=50, default="", blank=True)
    path = gis_models.LineStringField(geography=True)
    start_name = models.CharField(max_length=255, default="", blank=True)
    end_name = models.CharField(max_length=255, default="", blank=True)
    total_distance_meters = models.FloatField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

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
        indexes = [
            models.Index(fields=["route", "order"]),
        ]

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
        max_length=20,
        choices=[("bus", "Bus"), ("van", "Van"), ("minibus", "Minibus"), ("car", "Car")],
        default="bus",
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
        unique_together = (("student", "vehicle"),)


class ActiveTrip(models.Model):
    STATUS_CHOICES = (
        ("active", "Active"),
        ("inactive", "Inactive"),
    )

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    vehicle = models.ForeignKey(Vehicle, on_delete=models.CASCADE, null=True, blank=True)
    route = models.ForeignKey(Route, on_delete=models.CASCADE)
    driver = models.ForeignKey(
        User_model,
        on_delete=models.CASCADE,
        related_name="trips",
        null=True,
    )
    status = models.CharField(
        max_length=10, choices=STATUS_CHOICES, default="inactive", db_index=True
    )
    current_location = gis_models.PointField(srid=4326, null=True, blank=True)
    last_updated = models.DateTimeField(auto_now=True, db_index=True)
    started_at = models.DateTimeField(default=timezone.now, editable=False)


    # Keep legacy field for backward compat with old consumers code
    is_active = models.BooleanField(default=True)

    class Meta:
        indexes = [
            models.Index(fields=["status", "last_updated"]),
        ]

    def __str__(self):
        return f"Trip {self.id} - {self.route.name} [{self.status}]"

    def save(self, *args, **kwargs):
        # Keep is_active in sync with status for any legacy code
        self.is_active = (self.status == "active")
        super().save(*args, **kwargs)


# ─── NEW MODELS ───────────────────────────────────────────────────────────────

class StudentProfile(models.Model):
    user = models.OneToOneField(
        User_model, on_delete=models.CASCADE, related_name="student_profile"
    )
    student_name = models.CharField(max_length=255, default="", blank=True)
    student_id = models.CharField(max_length=100, unique=True, null=True, blank=True, default=None)
    profile_photo = models.CharField(max_length=500, default="", blank=True)  # S3 URL
    bus_pass_id = models.CharField(max_length=100, unique=True, null=True, blank=True, default=None)
    bus_pass_validity = models.DateField(null=True, blank=True)
    phone_number = models.CharField(max_length=20, default="", blank=True)
    home_address = models.CharField(max_length=500, default="", blank=True)
    home_location = gis_models.PointField(srid=4326, null=True, blank=True)
    pickup_stop = gis_models.PointField(srid=4326, null=True, blank=True)
    current_location = gis_models.PointField(srid=4326, null=True, blank=True)
    last_active_at = models.DateTimeField(null=True, blank=True)

    def __str__(self):
        return f"StudentProfile: {self.user.email}"

    @property
    def boarding_eligible(self):
        from django.utils import timezone
        if not self.bus_pass_validity:
            return False
        return self.bus_pass_validity >= timezone.now().date()


class DriverProfile(models.Model):
    VEHICLE_TYPE_CHOICES = (
        ("bus", "Bus"),
        ("van", "Van"),
        ("minibus", "Minibus"),
    )

    user = models.OneToOneField(
        User_model, on_delete=models.CASCADE, related_name="driver_profile"
    )
    driver_name = models.CharField(max_length=255, default="", blank=True)
    license_number = models.CharField(max_length=100, unique=True, null=True, blank=True, default=None)
    vehicle_number = models.CharField(max_length=50, default="", blank=True)
    vehicle_type = models.CharField(
        max_length=20, choices=VEHICLE_TYPE_CHOICES, default="bus"
    )

    def __str__(self):
        return f"DriverProfile: {self.user.email}"


class BulkUploadLog(models.Model):
    uploaded_by = models.ForeignKey(
        User_model, on_delete=models.CASCADE, related_name="bulk_uploads"
    )
    file_name = models.CharField(max_length=255, default="", blank=True)
    total_rows = models.IntegerField(default=0)
    success_count = models.IntegerField(default=0)
    error_count = models.IntegerField(default=0)
    errors = models.JSONField(default=list)  # [{"row": 3, "reason": "..."}]
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"Upload by {self.uploaded_by.email} at {self.created_at} ({self.success_count}/{self.total_rows})"
