import uuid

from django.db import models
from django.utils import timezone
from django.contrib.gis.db import models as gis_models

from accounts.models import User

from transport.models import (
    City,
    Route,
    Stop,
    TripSchedule,
)

from common.constants import (
    VEHICLE_TYPE_CHOICES,
    VEHICLE_STATUS_CHOICES,
    VEHICLE_STATUS_PENDING,
    TRIP_STATUS_CHOICES,
    TRIP_STATUS_ACTIVE,
    BOARDING_STATUS_CHOICES,
)


class Vehicle(models.Model):
    """
    Physical vehicle.
    """

    id = models.UUIDField(
        primary_key=True,
        default=uuid.uuid4,
        editable=False,
    )

    city = models.ForeignKey(
        City,
        related_name="vehicles",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
    )

    route = models.ForeignKey(
        Route,
        related_name="vehicles",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
    )

    driver = models.OneToOneField(
        User,
        related_name="assigned_vehicle",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
    )

    vehicle_number = models.CharField(
        max_length=50,
        unique=True,
    )

    vehicle_type = models.CharField(
        max_length=20,
        choices=VEHICLE_TYPE_CHOICES,
    )

    vehicle_photo = models.TextField(
        default="",
        blank=True,
        help_text="Base64-encoded vehicle photo",
    )

    status = models.CharField(
        max_length=20,
        choices=VEHICLE_STATUS_CHOICES,
        default=VEHICLE_STATUS_PENDING,
    )

    is_active = models.BooleanField(
        default=True,
    )

    created_at = models.DateTimeField(
        auto_now_add=True,
    )

    updated_at = models.DateTimeField(
        auto_now=True,
    )

    class Meta:
        ordering = ["vehicle_number"]
        indexes = [
            models.Index(
                fields=["vehicle_number"]
            ),
        ]

    def __str__(self):
        return self.vehicle_number
    

class ActiveTrip(models.Model):
    """
    Live running trip.
    """

    id = models.UUIDField(
        primary_key=True,
        default=uuid.uuid4,
        editable=False,
    )

    vehicle = models.ForeignKey(
        Vehicle,
        related_name="trips",
        on_delete=models.CASCADE,
    )

    route = models.ForeignKey(
        Route,
        related_name="active_trips",
        on_delete=models.CASCADE,
    )

    trip_schedule = models.ForeignKey(
        TripSchedule,
        related_name="active_trips",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
    )

    driver = models.ForeignKey(
        User,
        related_name="driver_trips",
        on_delete=models.CASCADE,
    )

    status = models.CharField(
        max_length=20,
        choices=TRIP_STATUS_CHOICES,
        default=TRIP_STATUS_ACTIVE,
        db_index=True,
    )

    direction = models.CharField(
        max_length=10,
        choices=(
            ("outbound", "Outbound (first→last)"),
            ("inbound", "Inbound (last→first)"),
        ),
        default="outbound",
        db_index=True,
    )

    current_stop = models.ForeignKey(
        Stop,
        related_name="trips_at_stop",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
    )

    current_segment_index = models.PositiveIntegerField(
        default=0,
        help_text="Index into route.stops ordered list; vehicle is between stop[i] and stop[i+1]",
    )

    current_location = gis_models.PointField(
        geography=True,
        null=True,
        blank=True,
    )

    started_at = models.DateTimeField(
        default=timezone.now,
    )

    ended_at = models.DateTimeField(
        null=True,
        blank=True,
    )

    last_updated = models.DateTimeField(
        auto_now=True,
    )

    otp = models.CharField(
        max_length=4,
        null=True,
        blank=True,
        help_text="4-digit OTP for passenger-driver handshake verification",
    )

    total_distance_m = models.FloatField(
        null=True,
        blank=True,
        help_text="Total trip distance in meters (from OSRM)",
    )

    total_duration_s = models.FloatField(
        null=True,
        blank=True,
        help_text="Total trip duration in seconds (from OSRM)",
    )

    total_fare = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        null=True,
        blank=True,
        help_text="Total fare for the trip",
    )

    class Meta:
        ordering = ["-started_at"]

        indexes = [
            models.Index(
                fields=[
                    "status",
                    "started_at",
                ]
            ),
            models.Index(
                fields=[
                    "driver",
                    "status",
                ]
            ),
            models.Index(
                fields=[
                    "route",
                    "status",
                    "direction",
                ]
            ),
        ]

    def __str__(self):
        return (
            f"{self.route.name}"
            f" ({self.status}/{self.direction})"
        )


class TripRating(models.Model):
    id = models.UUIDField(
        primary_key=True,
        default=uuid.uuid4,
        editable=False,
    )
    trip = models.OneToOneField(
        ActiveTrip,
        on_delete=models.CASCADE,
        related_name="rating_record",
    )
    passenger = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name="given_ratings",
    )
    driver = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name="received_ratings",
    )
    rating = models.PositiveSmallIntegerField()
    review = models.TextField(
        blank=True,
        null=True,
    )
    created_at = models.DateTimeField(
        auto_now_add=True,
    )

    class Meta:
        indexes = [
            models.Index(fields=["rating"]),
            models.Index(fields=["driver"]),
            models.Index(fields=["created_at"]),
        ]


class VehicleState(models.Model):
    """
    Runtime state — extended with route-based tracking fields.
    """

    vehicle = models.OneToOneField(
        Vehicle,
        related_name="state",
        on_delete=models.CASCADE,
    )

    active_trip = models.ForeignKey(
        ActiveTrip,
        related_name="vehicle_states",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
    )

    delay_minutes = models.IntegerField(
        default=0,
    )

    occupancy_count = models.PositiveIntegerField(
        default=0,
    )

    speed_kmph = models.FloatField(
        default=0,
    )

    heading = models.FloatField(
        default=0,
    )

    current_location = gis_models.PointField(
        geography=True,
        null=True,
        blank=True,
    )

    snapped_location = gis_models.PointField(
        geography=True,
        null=True,
        blank=True,
        help_text="GPS point snapped to route geometry via OSRM map matching",
    )

    current_stop_index = models.PositiveIntegerField(
        default=0,
        help_text="Sequence index of the most recently passed or current stop",
    )

    current_segment_index = models.PositiveIntegerField(
        default=0,
        help_text="Index of the road segment the vehicle is currently on",
    )

    distance_along_route_m = models.FloatField(
        default=0,
        help_text="Cumulative distance travelled along the route in metres",
    )

    last_updated = models.DateTimeField(
        auto_now=True,
    )

    class Meta:
        indexes = [
            models.Index(
                fields=[
                    "last_updated",
                ]
            ),
        ]

    def __str__(self):
        return (
            f"{self.vehicle.vehicle_number}"
        )
    
class BoardingRequest(models.Model):
    """
    Passenger boarding intent.
    """

    id = models.UUIDField(
        primary_key=True,
        default=uuid.uuid4,
        editable=False,
    )

    passenger = models.ForeignKey(
        User,
        related_name="boarding_requests",
        on_delete=models.CASCADE,
    )

    trip = models.ForeignKey(
        ActiveTrip,
        related_name="boarding_requests",
        on_delete=models.CASCADE,
    )

    pickup_stop = models.ForeignKey(
        Stop,
        related_name="pickup_requests",
        on_delete=models.CASCADE,
    )

    drop_stop = models.ForeignKey(
        Stop,
        related_name="drop_requests",
        on_delete=models.CASCADE,
        null=True,
        blank=True,
    )

    status = models.CharField(
        max_length=20,
        choices=BOARDING_STATUS_CHOICES,
        default="pending",
        db_index=True,
    )

    created_at = models.DateTimeField(
        auto_now_add=True,
    )

    updated_at = models.DateTimeField(
        auto_now=True,
    )

    class Meta:
        ordering = ["-created_at"]

        constraints = [
            models.UniqueConstraint(
                fields=[
                    "passenger",
                    "trip",
                ],
                condition=models.Q(
                    status="pending"
                ),
                name="unique_pending_boarding_request",
            )
        ]

    def __str__(self):
        return (
            f"{self.passenger.email}"
            f" - {self.status}"
        )


class DispatchRequest(models.Model):
    """
    Broadcast dispatch request — sent to all nearby drivers on a route.
    First driver to accept wins; others get dismissed.
    """

    STATUS_PENDING = "pending"
    STATUS_ACCEPTED = "accepted"
    STATUS_CANCELLED = "cancelled"
    STATUS_EXPIRED = "expired"
    STATUS_CHOICES = (
        (STATUS_PENDING, "Pending"),
        (STATUS_ACCEPTED, "Accepted"),
        (STATUS_CANCELLED, "Cancelled"),
        (STATUS_EXPIRED, "Expired"),
    )

    id = models.UUIDField(
        primary_key=True,
        default=uuid.uuid4,
        editable=False,
    )

    passenger = models.ForeignKey(
        User,
        related_name="dispatch_requests",
        on_delete=models.CASCADE,
    )

    route = models.ForeignKey(
        Route,
        related_name="dispatch_requests",
        on_delete=models.CASCADE,
    )

    pickup_stop = models.ForeignKey(
        Stop,
        related_name="dispatch_requests",
        on_delete=models.CASCADE,
    )

    drop_stop = models.ForeignKey(
        Stop,
        related_name="dispatch_requests_drop",
        on_delete=models.CASCADE,
        null=True,
        blank=True,
    )

    drop_lat = models.FloatField(null=True, blank=True)
    drop_lng = models.FloatField(null=True, blank=True)

    status = models.CharField(
        max_length=20,
        choices=STATUS_CHOICES,
        default=STATUS_PENDING,
        db_index=True,
    )

    accepted_by = models.ForeignKey(
        User,
        null=True,
        blank=True,
        related_name="accepted_dispatches",
        on_delete=models.SET_NULL,
    )

    notified_drivers = models.JSONField(
        default=list,
        help_text="List of driver IDs who received the broadcast",
    )

    pickup_lat = models.FloatField(null=True, blank=True)
    pickup_lng = models.FloatField(null=True, blank=True)

    created_at = models.DateTimeField(auto_now_add=True)
    expires_at = models.DateTimeField()

    class Meta:
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["status", "created_at"]),
            models.Index(fields=["route", "status"]),
        ]

    def __str__(self):
        return f"DispatchRequest({self.id} | {self.status} | route={self.route.name})"