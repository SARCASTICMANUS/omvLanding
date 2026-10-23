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
    VEHICLE_AUTO,
    VEHICLE_BIKE,
    VEHICLE_TYPE_CHOICES,
    VEHICLE_STATUS_CHOICES,
    VEHICLE_STATUS_PENDING,
    TRIP_STATUS_CHOICES,
    TRIP_STATUS_ACTIVE,
    BOARDING_STATUS_CHOICES,
    BOARDING_PENDING,
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

    Two flavours share this table:

    * route trip - ``route`` is set; the vehicle follows a registered fixed
      route (legacy dispatch flow, kept for backwards compatibility).
    * journey - ``route`` is NULL; the driver declared a free-form
      origin -> destination. The road path and the ordered global stops along
      it live in Redis (tracking.services.journey_cache_service), while the
      durable trip facts (origin/destination/distance/fare) stay here.
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
        null=True,
        blank=True,
        help_text="NULL for a free-form journey (no fixed route).",
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
        help_text="Route-direction sense; meaningless for journeys.",
    )

    origin_point = gis_models.PointField(
        geography=True,
        null=True,
        blank=True,
        help_text="Journey start (driver-declared). NULL for route trips.",
    )

    destination_point = gis_models.PointField(
        geography=True,
        null=True,
        blank=True,
        help_text="Journey end (driver-declared). NULL for route trips.",
    )

    origin_name = models.CharField(
        max_length=255,
        blank=True,
        default="",
    )

    destination_name = models.CharField(
        max_length=255,
        blank=True,
        default="",
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
        # route is NULL for journeys, so name the declared endpoints instead of
        # dereferencing it.
        label = self.route.name if self.route_id else self.journey_label
        return f"{label} ({self.status})"

    @property
    def is_journey(self) -> bool:
        """True when this trip is a free-form journey (no fixed route)."""
        return self.route_id is None

    @property
    def journey_label(self) -> str:
        origin = self.origin_name or (
            f"{self.origin_point.y:.5f}, {self.origin_point.x:.5f}"
            if self.origin_point
            else "Origin"
        )
        destination = self.destination_name or (
            f"{self.destination_point.y:.5f}, {self.destination_point.x:.5f}"
            if self.destination_point
            else "Destination"
        )
        return f"{origin} → {destination}"


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


class FareConfiguration(models.Model):
    """
    Per-vehicle-type fare rates that can be configured via the admin.
    Replaces the hardcoded ``VEHICLE_FARE_RATES`` dict in
    ``operations/services/fare_service.py``.
    """

    VEHICLE_TYPE_CHOICES = [
        (VEHICLE_AUTO, "auto"),
        (VEHICLE_BIKE, "bike"),
    ]

    vehicle_type = models.CharField(
        max_length=10,
        choices=VEHICLE_TYPE_CHOICES,
    )
    base_fare = models.IntegerField(
        help_text="Base fare in the smallest currency unit (e.g. cents)."
    )
    per_km_rate = models.IntegerField(
        help_text="Rate per kilometre in the smallest currency unit per km."
    )
    effective_from = models.DateTimeField(
        default=timezone.now,
        help_text="When this configuration becomes active.",
    )
    is_active = models.BooleanField(
        default=True,
        help_text="Whether this configuration is the one currently in force.",
    )

    class Meta:
        verbose_name = "Fare Configuration"
        verbose_name_plural = "Fare Configurations"
        ordering = ["vehicle_type", "-effective_from"]
        constraints = [
            models.UniqueConstraint(
                fields=("vehicle_type",),
                condition=models.Q(is_active=True),
                name="unique_active_fare_per_vehicle_type",
            ),
        ]

    def __str__(self):
        return f"{self.get_vehicle_type_display()} fare (₪{self.base_fare / 100:.2f} + {self.per_km_rate / 100:.2f}/km)"


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
        default=BOARDING_PENDING,
        db_index=True,
    )

    otp = models.CharField(
        max_length=4,
        null=True,
        blank=True,
        help_text=(
            "4-digit safety code for this boarding. Lives here rather than on "
            "the trip because a journey serves many passengers at once."
        ),
    )

    # ── settled segment ──────────────────────────────────────
    #
    # What this one passenger actually rode and paid for. One journey serves
    # many passengers, so the trip's own distance and fare describe the driver's
    # whole run, not any single rider -- these three describe the pickup→drop
    # segment and are written when the journey settles.
    segment_distance_m = models.FloatField(
        null=True,
        blank=True,
        help_text=(
            "Road distance in metres for this passenger's pickup→drop "
            "segment. NULL until the trip settles."
        ),
    )

    segment_duration_s = models.FloatField(
        null=True,
        blank=True,
        help_text="Road duration in seconds for this passenger's segment.",
    )

    fare = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        null=True,
        blank=True,
        help_text=(
            "Fare charged for this passenger's segment. Recorded at settlement "
            "so the fare screens show what was actually billed rather than "
            "recomputing it from stops that may later be edited."
        ),
    )

    dropped_off_at = models.DateTimeField(
        null=True,
        blank=True,
        help_text="When the journey settled and this rider's fare was fixed.",
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
                    status=BOARDING_PENDING
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
    Broadcast dispatch request — sent to every driver who can serve it.

    For the fixed-route flow the request is scoped by ``route``; for the
    journey flow ``route`` is NULL and the candidate set comes from the global
    stops passed on each driver's journey (Redis). First driver to accept wins;
    the others get dismissed.
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
        null=True,
        blank=True,
        help_text="NULL for a journey-scoped request (pickup by global stop).",
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

    passenger_fare = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)

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

    # Drivers who explicitly dismissed this broadcast. Kept separate from
    # notified_drivers: that field is the authoritative "was this ride ever
    # offered to you" list for the accept guard and for the post-accept
    # dismissal sweep, so it must never shrink. This one only ever grows, and
    # it is the exclusion set the expiry cascade consults before re-notifying.
    dismissed_drivers = models.JSONField(
        default=list,
        help_text="Driver IDs who dismissed this broadcast; never re-notified",
    )

    # How many expiry rounds this request has been through, and how many it is
    # allowed. Without a persisted counter the cascade is unbounded: each round
    # re-schedules itself, so a request whose drivers all sit idle would
    # re-notify them every 45s indefinitely.
    attempt_count = models.PositiveIntegerField(
        default=0,
        help_text="Expiry cascade rounds already spent on this request",
    )
    max_rounds = models.PositiveIntegerField(
        default=3,
        help_text="Maximum expiry cascade rounds before the request is expired",
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
