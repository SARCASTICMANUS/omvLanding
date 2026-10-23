import uuid

from django.contrib.postgres.indexes import GinIndex
from django.contrib.postgres.search import SearchVector
from django.db import models
from django.contrib.gis.db import models as gis_models
from django.utils.text import slugify

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
    slug = models.SlugField(max_length=255, unique=True, blank=True)
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

    def save(self, *args, **kwargs):
        if not self.slug:
            base = slugify(self.name) or "city"
            candidate = base
            suffix = 2
            while City.objects.filter(slug=candidate).exclude(pk=self.pk).exists():
                candidate = f"{base}-{suffix}"
                suffix += 1
            self.slug = candidate
        else:
            self.slug = slugify(self.slug) or slugify(self.name) or "city"
            base = self.slug
            candidate = base
            suffix = 2
            while City.objects.filter(slug=candidate).exclude(pk=self.pk).exists():
                candidate = f"{base}-{suffix}"
                suffix += 1
            self.slug = candidate
        super().save(*args, **kwargs)

    def __str__(self):
        return f"{self.name}, {self.state}"


class CityAdminConfiguration(models.Model):
    """Admin-managed service and fare settings for one city."""

    ROUNDING_CHOICES = (
        ("none", "None"),
        ("nearest_unit", "Nearest whole rupee"),
        ("ceil_unit", "Round up to whole rupee"),
        ("floor_unit", "Round down to whole rupee"),
    )

    city = models.OneToOneField(City, on_delete=models.CASCADE, related_name="admin_configuration")
    currency = models.CharField(max_length=3, default="INR")
    fare_per_km = models.DecimalField(max_digits=10, decimal_places=2, default=8)
    platform_fee = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    rounding_rule = models.CharField(max_length=20, choices=ROUNDING_CHOICES, default="none")
    corridor_m = models.PositiveIntegerField(default=100)
    max_walk_to_stop_m = models.PositiveIntegerField(default=3000)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"{self.city.slug} admin configuration"


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

    source_route_id = models.CharField(max_length=100, blank=True, default="")
    source_direction_id = models.CharField(max_length=100, blank=True, default="")
    route_number = models.CharField(max_length=100, blank=True, default="")
    direction_name = models.CharField(max_length=255, blank=True, default="")
    route_geometry_id = models.CharField(max_length=100, blank=True, default="")
    source_name = models.CharField(max_length=255, blank=True, default="")
    source_reference = models.CharField(max_length=500, blank=True, default="")

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

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=["city", "source_route_id", "source_direction_id"],
                condition=models.Q(source_route_id__gt=""),
                name="transport_route_source_direction_unique",
            ),
        ]

    def __str__(self):
        return self.name
    

class Stop(models.Model):
    """
    A boarding location.

    Two flavours share this table:

    * route stop - ``route`` is set, ``order`` is its position on the route.
      These belong to the fixed-route (legacy) dispatch flow.
    * global stop - ``route`` is NULL. Admin-maintained boarding points that
      are not bound to any route and are matched against driver journeys by
      proximity (see tracking.services.corridor_service).

    ``is_global`` is the readable discriminator; it is kept in sync with
    ``route is null`` so callers never have to test both.
    """

    id = models.UUIDField(
        primary_key=True,
        default=uuid.uuid4,
        editable=False,
    )

    route = models.ForeignKey(
        Route,
        related_name="stops",
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        help_text="NULL for admin-created global stops.",
    )

    city = models.ForeignKey(
        City,
        related_name="stops",
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        help_text="Owning city for global stops; optional for route stops.",
    )

    name = models.CharField(
        max_length=255,
    )

    COORDINATE_STATUS_CHOICES = (
        ("verified", "Verified"),
        ("provisional", "Provisional"),
        ("conflict", "Conflict"),
        ("unresolved", "Unresolved"),
        ("legacy_synthetic", "Legacy synthetic"),
    )
    coordinate_status = models.CharField(max_length=24, choices=COORDINATE_STATUS_CHOICES, default="verified")
    aliases = models.JSONField(default=list, blank=True)
    serviceability_reason = models.CharField(max_length=255, blank=True, default="")
    source_stop_id = models.CharField(max_length=100, blank=True, default="")
    boarding_allowed = models.BooleanField(default=True)
    alighting_allowed = models.BooleanField(default=True)
    source_name = models.CharField(max_length=255, blank=True, default="")
    source_reference = models.CharField(max_length=500, blank=True, default="")

    location = gis_models.PointField(
        geography=True,
    )

    order = models.PositiveIntegerField(
        default=0,
        help_text="Position on the route for route stops; unused for global stops.",
    )

    is_global = models.BooleanField(
        default=False,
        help_text="Admin-managed stop not attached to a route.",
    )

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
        constraints = [
            # Route stops must stay uniquely ordered per route. Global stops have
            # no route, so the (route, order) pair must not be constrained for
            # them or every global stop would collide at order=0.
            models.UniqueConstraint(
                fields=["route", "order"],
                condition=models.Q(route__isnull=False),
                name="transport_stop_route_order_unique",
            ),
        ]
        indexes = [
            GinIndex(
                fields=["name"],
                opclasses=["gin_trgm_ops"],
                name="transport_stop_name_trgm",
            ),
            GinIndex(
                SearchVector("name", config="english"),
                name="transport_stop_name_fts",
            ),
        ]

    def __str__(self):
        return self.name

    def save(self, *args, **kwargs):
        # Keep is_global consistent with the presence of a route so callers can
        # query either without having to remember the null convention.
        self.is_global = self.route_id is None
        return super().save(*args, **kwargs)

    @property
    def coords(self):
        """(lng, lat) tuple for this stop's location."""
        return (self.location.x, self.location.y)


class RouteStopAssociation(models.Model):
    """Ordered membership of an existing physical stop on one route direction."""

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    route = models.ForeignKey(Route, related_name="route_stop_associations", on_delete=models.CASCADE)
    stop = models.ForeignKey(Stop, related_name="route_memberships", on_delete=models.PROTECT)
    order = models.PositiveIntegerField()
    boarding_allowed = models.BooleanField(default=True)
    alighting_allowed = models.BooleanField(default=True)

    class Meta:
        ordering = ["order"]
        constraints = [
            models.UniqueConstraint(
                fields=["route", "order"],
                name="transport_route_stop_association_order_unique",
            ),
        ]

    def clean(self):
        from django.core.exceptions import ValidationError

        if self.stop_id and self.stop.route_id:
            raise ValidationError({"stop": "Route membership must reference an existing global stop."})
        if self.stop_id and self.stop.city_id != self.route.city_id:
            raise ValidationError({"stop": "The stop and route must belong to the same city."})

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


