from rest_framework import serializers

from common.constants import (
    JOURNEY_CORRIDOR_RADIUS_M,
    PASSENGER_HAND_RAISE_RADIUS_M,
    TRIP_STATUS_ACTIVE,
)
from tracking.models import HybridLog
from operations.models import (
    ActiveTrip,
    BoardingRequest,
    Vehicle,
    VehicleState,
)
from transport.models import Route, Stop
from tracking.services.geo_service import GeoService


class LocationSerializer(serializers.Serializer):
    lat = serializers.FloatField()
    lng = serializers.FloatField()

    def validate_lat(self, value):
        if value < -90 or value > 90:
            raise serializers.ValidationError(
                "Latitude must be between -90 and 90."
            )
        return value

    def validate_lng(self, value):
        if value < -180 or value > 180:
            raise serializers.ValidationError(
                "Longitude must be between -180 and 180."
            )
        return value


class HybridLogSerializer(serializers.ModelSerializer):

    class Meta:
        model = HybridLog
        fields = "__all__"


class TelemetryIngestSerializer(serializers.Serializer):
    vehicle_id = serializers.UUIDField(
        required=False,
        allow_null=True,
    )
    trip_id = serializers.UUIDField(
        required=False,
        allow_null=True,
    )
    lat = serializers.FloatField()
    lng = serializers.FloatField()
    speed = serializers.FloatField(
        required=False,
        default=0,
    )
    heading = serializers.FloatField(
        required=False,
        default=0,
    )
    cell_towers = serializers.ListField(
        required=False,
        default=list,
    )
    wifi_aps = serializers.ListField(
        required=False,
        default=list,
    )

    def validate_lat(self, value):
        if value < -90 or value > 90:
            raise serializers.ValidationError(
                "Latitude must be between -90 and 90."
            )
        return value

    def validate_lng(self, value):
        if value < -180 or value > 180:
            raise serializers.ValidationError(
                "Longitude must be between -180 and 180."
            )
        return value

    def validate_heading(self, value):
        if value < 0 or value > 360:
            raise serializers.ValidationError(
                "Heading must be between 0 and 360."
            )
        return value

    def validate(self, attrs):
        vehicle = None
        trip = None

        vehicle_id = attrs.get("vehicle_id")
        if vehicle_id:
            vehicle = (
                Vehicle.objects
                .filter(id=vehicle_id)
                .first()
            )
            if not vehicle:
                raise serializers.ValidationError(
                    {
                        "vehicle_id": (
                            "Vehicle not found."
                        )
                    }
                )

        trip_id = attrs.get("trip_id")
        if trip_id:
            trip = (
                ActiveTrip.objects
                .select_related("vehicle")
                .filter(id=trip_id)
                .first()
            )
            if not trip:
                raise serializers.ValidationError(
                    {
                        "trip_id": (
                            "Trip not found."
                        )
                    }
                )
            if vehicle and trip.vehicle_id != vehicle.id:
                raise serializers.ValidationError(
                    {
                        "vehicle_id": (
                            "Vehicle does not match "
                            "the trip vehicle."
                        )
                    }
                )
            if not vehicle:
                vehicle = trip.vehicle

        attrs["vehicle"] = vehicle
        attrs["trip"] = trip

        return attrs


# ── Route-based serializers ──────────────────────────────────


class StartRouteTripSerializer(serializers.Serializer):
    """Driver starts a trip on a fixed route."""
    vehicle_id = serializers.UUIDField()
    route_id = serializers.UUIDField()
    direction = serializers.ChoiceField(
        choices=(("outbound", "Outbound"), ("inbound", "Inbound")),
        default="outbound",
    )

    def validate_vehicle_id(self, value):
        try:
            vehicle = Vehicle.objects.get(id=value)
        except Vehicle.DoesNotExist:
            raise serializers.ValidationError("Vehicle not found.")
        return value

    def validate_route_id(self, value):
        try:
            Route.objects.get(id=value)
        except Route.DoesNotExist:
            raise serializers.ValidationError("Route not found.")
        return value

    def validate(self, attrs):
        vehicle = Vehicle.objects.get(id=attrs["vehicle_id"])
        route = Route.objects.get(id=attrs["route_id"])
        attrs["_vehicle"] = vehicle
        attrs["_route"] = route

        # Verify vehicle is not already on an active trip
        if ActiveTrip.objects.filter(vehicle=vehicle, status=TRIP_STATUS_ACTIVE).exists():
            raise serializers.ValidationError(
                "Vehicle already has an active trip."
            )
        return attrs


# ── Journey serializers ───────────────────────────────────────


class LatLngSerializer(serializers.Serializer):
    """A point as latitude + longitude."""

    lat = serializers.FloatField(min_value=-90.0, max_value=90.0)
    lng = serializers.FloatField(min_value=-180.0, max_value=180.0)


class StartJourneySerializer(serializers.Serializer):
    """
    Driver declares a free-form journey: where they are going and where to.

    Both endpoints are required. The journey's road path is resolved from them
    server-side and is mandatory, so a journey without both is not a journey.
    """

    vehicle_id = serializers.UUIDField()
    origin = LatLngSerializer()
    destination = LatLngSerializer()
    origin_name = serializers.CharField(
        required=False, allow_blank=True, max_length=255, default=""
    )
    destination_name = serializers.CharField(
        required=False, allow_blank=True, max_length=255, default=""
    )

    def validate_vehicle_id(self, value):
        vehicle = Vehicle.objects.filter(id=value).first()
        if not vehicle:
            raise serializers.ValidationError("Vehicle not found.")
        # Ownership is enforced in JourneyService against the request user; this
        # check only confirms the vehicle exists so the error names the problem.
        return value


class PreviewJourneySerializer(serializers.Serializer):
    """
    Preview a journey before starting it: the two endpoints only.

    No vehicle is involved, because nothing is created: this resolves the road
    path and its stops so the driver can see them before committing.
    """

    origin = LatLngSerializer()
    destination = LatLngSerializer()


class CorridorSearchSerializer(serializers.Serializer):
    """
    Search for live vehicles along a corridor between two points.

    Same shape as the journey preview (origin/destination only) because it asks
    the same routing question; the difference is who calls it and what comes
    back. This is the passenger's "which vehicle can I get on for this route?"
    and it must not start a journey.
    """

    origin = LatLngSerializer()
    destination = LatLngSerializer()
    radius = serializers.IntegerField(
        required=False,
        min_value=100,
        max_value=20000,
        default=JOURNEY_CORRIDOR_RADIUS_M,
        help_text="Corridor half-width in metres.",
    )
    limit = serializers.IntegerField(required=False, min_value=1, max_value=50, default=20)


class EndJourneySerializer(serializers.Serializer):
    """Driver finishes their journey."""

    trip_id = serializers.UUIDField()
    cancel = serializers.BooleanField(
        required=False,
        default=False,
        help_text="End without settling (e.g. the driver abandoned the journey).",
    )


class PassengerRaiseHandSerializer(serializers.Serializer):
    """
    Passenger requests a ride from a stop.

    Two scopes:

    * ``route_id`` given - the fixed-route flow; pickup and dropoff must be
      stops on that route.
    * ``route_id`` omitted - the journey flow. ``pickup_stop_id`` is an
      admin-created global stop, ``dropoff_stop_id`` is optional, and the
      passenger must be physically near the pickup stop.
    """

    route_id = serializers.UUIDField(required=False, allow_null=True, default=None)
    pickup_stop_id = serializers.UUIDField()
    dropoff_stop_id = serializers.UUIDField(
        required=False, allow_null=True, default=None
    )
    lat = serializers.FloatField()
    lng = serializers.FloatField()

    def validate_lat(self, value):
        if value < -90 or value > 90:
            raise serializers.ValidationError("Latitude must be between -90 and 90.")
        return value

    def validate_lng(self, value):
        if value < -180 or value > 180:
            raise serializers.ValidationError("Longitude must be between -180 and 180.")
        return value

    def validate(self, attrs):
        route_id = attrs["route_id"]
        pickup_id = attrs["pickup_stop_id"]
        dropoff_id = attrs["dropoff_stop_id"]
        pickup = Stop.objects.filter(id=pickup_id).first()

        if not pickup:
            raise serializers.ValidationError(
                {"pickup_stop_id": "Pickup stop not found."}
            )

        distance_m = GeoService.haversine_m(
            attrs["lat"], attrs["lng"], pickup.location.y, pickup.location.x
        )
        # Allow centimetre-scale floating point noise at the inclusive limit.
        if distance_m > PASSENGER_HAND_RAISE_RADIUS_M + 0.01:
            raise serializers.ValidationError(
                {
                    "pickup_stop_id": (
                        f"You must be within {PASSENGER_HAND_RAISE_RADIUS_M} meters "
                        "of the stop to raise your hand."
                    )
                }
            )

        if route_id:
            # Route-scoped: both stops must sit on the requested route, and the
            # pickup must precede the drop. Compared as UUIDs, not strings:
            # route_id arrives as a UUID and pickup.route_id is one, so a
            # string comparison never matches.
            if str(pickup.route_id) != str(route_id):
                raise serializers.ValidationError(
                    {"pickup_stop_id": "Pickup stop not found on this route."}
                )
            if not dropoff_id:
                raise serializers.ValidationError(
                    {"dropoff_stop_id": "Required when requesting a ride on a route."}
                )
            dropoff = Stop.objects.filter(id=dropoff_id, route_id=route_id).first()
            if not dropoff:
                raise serializers.ValidationError(
                    {"dropoff_stop_id": "Dropoff stop not found on this route."}
                )
            if pickup.order == dropoff.order:
                raise serializers.ValidationError(
                    "Pickup and dropoff stops must be different."
                )
            attrs["_dropoff"] = dropoff
        else:
            # Journey-scoped: the hand is raised at a stop, so the passenger has
            # to actually be there. Without this, a passenger anywhere could name
            # any global stop and be served by drivers passing it.
            if dropoff_id and str(dropoff_id) == str(pickup_id):
                raise serializers.ValidationError(
                    "Pickup and dropoff stops must be different."
                )
            attrs["_dropoff"] = (
                Stop.objects.filter(id=dropoff_id).first() if dropoff_id else None
            )

        attrs["_pickup"] = pickup
        return attrs


class RideLifecycleSerializer(serializers.Serializer):
    """Accept / reject / board / complete a ride."""
    request_id = serializers.UUIDField()
    action = serializers.ChoiceField(
        choices=(
            ("accept", "Accept"),
            ("reject", "Reject"),
            ("board", "Board"),
            ("complete", "Complete"),
        )
    )

    def validate_request_id(self, value):
        try:
            BoardingRequest.objects.get(id=value)
        except BoardingRequest.DoesNotExist:
            raise serializers.ValidationError("Ride request not found.")
        return value


class StopETASerializer(serializers.ModelSerializer):
    class Meta:
        model = Stop
        fields = ["id", "name", "order", "location", "cumulative_distance_m", "cumulative_duration_s"]


class RouteStopListSerializer(serializers.ModelSerializer):
    stops = StopETASerializer(many=True, read_only=True)

    class Meta:
        model = Route
        fields = ["id", "name", "route_code", "start_name", "end_name", "stops"]
