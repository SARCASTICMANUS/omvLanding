# VAYY | core/models.py | Status: ✅ Public Transport Refactor
# Converted from University/Student model to Public City/Passenger/Driver model.

from django.contrib.auth.models import AbstractUser
from django.db import models
from django.contrib.gis.db import models as gis_models
from django.contrib.auth import get_user_model
from django.utils import timezone
import uuid

from django.contrib.auth.models import BaseUserManager

class UserManager(BaseUserManager):
    def create_user(self, email, password=None, **extra_fields):
        if not email:
            raise ValueError("Email is required")

        email = self.normalize_email(email)

        # fallback username (since field still exists)
        extra_fields.setdefault("username", email)

        user = self.model(email=email, **extra_fields)
        user.set_password(password)
        user.save(using=self._db)
        return user

    def create_superuser(self, email, password=None, **extra_fields):
        extra_fields.setdefault("is_staff", True)
        extra_fields.setdefault("is_superuser", True)
        extra_fields.setdefault("username", email)

        return self.create_user(email, password, **extra_fields)


# ─── City (replaces University) ───────────────────────────────────────────────

class City(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=255)
    state = models.CharField(max_length=255, default="", blank=True)
    country = models.CharField(max_length=255, default="India", blank=True)
    location = gis_models.PointField(geography=True, null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name_plural = "Cities"
        ordering = ["name"]

    def __str__(self):
        return f"{self.name}, {self.state}"


# ─── User ─────────────────────────────────────────────────────────────────────

class User(AbstractUser):
    ROLE_CHOICES = (
        ("passenger", "Passenger"),
        ("driver", "Driver"),
        ("city_admin", "City Admin"),
        ("admin", "Admin"),
    )

    email = models.EmailField(unique=True)
    role = models.CharField(max_length=20, choices=ROLE_CHOICES, default="passenger")
    city = models.ForeignKey(
        City, on_delete=models.SET_NULL, null=True, blank=True, related_name="users"
    )

    # OTP Verification
    otp = models.CharField(max_length=6, null=True, blank=True)
    otp_verified = models.BooleanField(default=False)
    otp_created_at = models.DateTimeField(null=True, blank=True)
    is_verified = models.BooleanField(default=False)

    # Legacy driver fields (kept for compatibility)
    vehicle_type = models.CharField(max_length=20, null=True, blank=True)
    vehicle_number = models.CharField(max_length=20, null=True, blank=True)

    USERNAME_FIELD = "email"
    REQUIRED_FIELDS = []

    objects = UserManager()

    def __str__(self):
        return self.email


User_model = get_user_model()


# ─── Route ────────────────────────────────────────────────────────────────────

class Route(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    city = models.ForeignKey(
        City, on_delete=models.CASCADE, related_name="routes", null=True, blank=True
    )
    name = models.CharField(max_length=255)
    bus_number = models.CharField(max_length=50, default="", blank=True)
    path = gis_models.LineStringField(geography=True)
    start_name = models.CharField(max_length=255, default="", blank=True)
    end_name = models.CharField(max_length=255, default="", blank=True)
    total_distance_meters = models.FloatField(default=0)
    is_public = models.BooleanField(default=True)  # Public routes are visible to all
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        city_name = self.city.name if self.city else "No City"
        return f"{self.name} ({city_name})"


# ─── Stop ─────────────────────────────────────────────────────────────────────

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


# ─── Schedule Management ──────────────────────────────────────────────────────

class TripSchedule(models.Model):
    """Represents a specific daily instance/time-slot of a route (e.g. 8:30 AM Slot)."""
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    route = models.ForeignKey(Route, on_delete=models.CASCADE, related_name="schedules")
    scheduled_start_time = models.TimeField()
    label = models.CharField(max_length=100, help_text="e.g. Morning Shift A")
    is_active = models.BooleanField(default=True)

    def __str__(self):
        return f"{self.route.name} @ {self.scheduled_start_time} ({self.label})"


class StopTime(models.Model):
    """Static schedule for when a bus SHOULD be at a specific stop for a TripSchedule."""
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    trip_schedule = models.ForeignKey(TripSchedule, on_delete=models.CASCADE, related_name="stop_times")
    stop = models.ForeignKey(Stop, on_delete=models.CASCADE)
    arrival_time = models.TimeField()
    stop_sequence = models.PositiveIntegerField()

    class Meta:
        ordering = ["stop_sequence"]
        unique_together = ("trip_schedule", "stop")

    def __str__(self):
        return f"{self.trip_schedule.label} - {self.stop.name} @ {self.arrival_time}"


# ─── Vehicle ──────────────────────────────────────────────────────────────────

class Vehicle(models.Model):
    VEHICLE_TYPE_CHOICES = [
        ("bus", "Bus"),
        ("van", "Van"),
        ("minibus", "Minibus"),
        ("car", "Car"),
        ("auto", "Auto-Rickshaw"),
        ("tempo", "Tempo Traveller"),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    city = models.ForeignKey(
        City, on_delete=models.SET_NULL, null=True, blank=True, related_name="vehicles"
    )
    route = models.ForeignKey(
        Route, on_delete=models.SET_NULL, null=True, blank=True, related_name="vehicles"
    )
    driver = models.OneToOneField(
        User_model,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="assigned_vehicle",
    )
    vehicle_number = models.CharField(max_length=50)
    vehicle_type = models.CharField(
        max_length=20,
        choices=VEHICLE_TYPE_CHOICES,
        default="bus",
    )

    def __str__(self):
        city_name = self.city.name if self.city else "No City"
        return f"{self.vehicle_number} ({city_name})"


class VehicleState(models.Model):
    """Real-time transient state of a vehicle, including schedule adherence."""
    vehicle = models.OneToOneField(Vehicle, on_delete=models.CASCADE, related_name="state")
    active_trip = models.ForeignKey("ActiveTrip", on_delete=models.SET_NULL, null=True, blank=True)
    delay_minutes = models.IntegerField(default=0)
    last_updated = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"State: {self.vehicle.vehicle_number} - {self.delay_minutes} min"


# ─── Active Trip ──────────────────────────────────────────────────────────────

class ActiveTrip(models.Model):
    STATUS_CHOICES = (
        ("active", "Active"),
        ("inactive", "Inactive"),
    )

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    vehicle = models.ForeignKey(Vehicle, on_delete=models.CASCADE, null=True, blank=True)
    route = models.ForeignKey(Route, on_delete=models.CASCADE)
    trip_schedule = models.ForeignKey(
        TripSchedule, on_delete=models.SET_NULL, null=True, blank=True, related_name="active_trips"
    )
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

    # Legacy field for backward compat
    is_active = models.BooleanField(default=True)

    class Meta:
        indexes = [
            models.Index(fields=["status", "last_updated"]),
        ]

    def __str__(self):
        return f"Trip {self.id} - {self.route.name} [{self.status}]"

    def save(self, *args, **kwargs):
        self.is_active = (self.status == "active")
        super().save(*args, **kwargs)


# ─── Public Passenger Profile (replaces StudentProfile) ───────────────────────

class PublicPassengerProfile(models.Model):
    user = models.OneToOneField(
        User_model, on_delete=models.CASCADE, related_name="passenger_profile"
    )
    display_name = models.CharField(max_length=255, default="", blank=True)
    phone_number = models.CharField(max_length=20, default="", blank=True)
    profile_photo = models.CharField(max_length=500, default="", blank=True)  # S3 URL
    home_location = gis_models.PointField(srid=4326, null=True, blank=True)
    current_location = gis_models.PointField(srid=4326, null=True, blank=True)
    last_active_at = models.DateTimeField(null=True, blank=True)

    # Saved/favourite routes
    saved_routes = models.ManyToManyField(Route, blank=True, related_name="saved_by")

    class Meta:
        indexes = [
            models.Index(fields=["last_active_at"]),
        ]

    def __str__(self):
        return f"PassengerProfile: {self.user.email}"


# ─── Boarding Requests ────────────────────────────────────────────────────────

class BoardingRequest(models.Model):
    STATUS_CHOICES = (
        ("pending", "Pending"),
        ("approaching", "Approaching"),
        ("boarded", "Boarded"),
        ("completed", "Completed"),
        ("cancelled", "Cancelled"),
    )

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    passenger = models.ForeignKey(User_model, on_delete=models.CASCADE, related_name="boarding_requests")
    trip = models.ForeignKey(ActiveTrip, on_delete=models.CASCADE, related_name="boarding_requests")
    pickup_stop = models.ForeignKey(Stop, on_delete=models.CASCADE, related_name="boarding_requests")
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default="pending", db_index=True)
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]
        unique_together = ("passenger", "trip", "status") # Prevent double booking for same trip unless cancelled

    def __str__(self):
        return f"Request {self.id}: {self.passenger.email} @ {self.pickup_stop.name} [{self.status}]"


# ─── Public Driver Profile (replaces DriverProfile) ───────────────────────────

class PublicDriverProfile(models.Model):
    VEHICLE_TYPE_CHOICES = (
        ("bus", "Bus"),
        ("van", "Van"),
        ("minibus", "Minibus"),
        ("car", "Car"),
        ("auto", "Auto-Rickshaw"),
        ("tempo", "Tempo Traveller"),
    )

    user = models.OneToOneField(
        User_model, on_delete=models.CASCADE, related_name="driver_profile"
    )
    display_name = models.CharField(max_length=255, default="", blank=True)
    phone_number = models.CharField(max_length=20, default="", blank=True)
    license_number = models.CharField(max_length=100, unique=True, null=True, blank=True, default=None)
    vehicle_number = models.CharField(max_length=50, default="", blank=True)
    vehicle_type = models.CharField(
        max_length=20, choices=VEHICLE_TYPE_CHOICES, default="bus"
    )
    is_verified = models.BooleanField(default=False)  # Admin can approve drivers
    rating = models.FloatField(default=5.0)
    total_trips = models.PositiveIntegerField(default=0)

    def __str__(self):
        return f"DriverProfile: {self.user.email}"


# ─── Hybrid Location Logs ─────────────────────────────────────────────────────

class HybridLog(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(User_model, on_delete=models.CASCADE, related_name="hybrid_logs")
    vehicle = models.ForeignKey(Vehicle, on_delete=models.SET_NULL, null=True, blank=True)
    trip = models.ForeignKey(ActiveTrip, on_delete=models.SET_NULL, null=True, blank=True)
    
    # Raw signal data
    cell_towers = models.JSONField(default=list, blank=True)  # List of dicts
    wifi_aps = models.JSONField(default=list, blank=True)     # List of dicts
    
    # Metadata
    device_id = models.CharField(max_length=255, db_index=True, null=True, blank=True)
    timestamp = models.DateTimeField(default=timezone.now, db_index=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-timestamp"]
        indexes = [
            models.Index(fields=["user", "timestamp"]),
        ]

    def __str__(self):
        return f"HybridLog {self.id} - {self.user.email} @ {self.timestamp}"
