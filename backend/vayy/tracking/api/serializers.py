from rest_framework import serializers

from tracking.models import HybridLog
from operations.models import (
    ActiveTrip,
    BoardingRequest,
    Vehicle,
    VehicleState,
)
from transport.models import Route, Stop


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
        if ActiveTrip.objects.filter(vehicle=vehicle, status="active").exists():
            raise serializers.ValidationError(
                "Vehicle already has an active trip."
            )
        return attrs


class PassengerRaiseHandSerializer(serializers.Serializer):
    """Passenger requests a ride between two stops on a route."""
    route_id = serializers.UUIDField()
    pickup_stop_id = serializers.UUIDField()
    dropoff_stop_id = serializers.UUIDField()
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

        try:
            pickup = Stop.objects.get(id=pickup_id, route_id=route_id)
        except Stop.DoesNotExist:
            raise serializers.ValidationError({"pickup_stop_id": "Pickup stop not found on this route."})

        try:
            dropoff = Stop.objects.get(id=dropoff_id, route_id=route_id)
        except Stop.DoesNotExist:
            raise serializers.ValidationError({"dropoff_stop_id": "Dropoff stop not found on this route."})

        if pickup.order == dropoff.order:
            raise serializers.ValidationError("Pickup and dropoff stops must be different.")

        attrs["_pickup"] = pickup
        attrs["_dropoff"] = dropoff
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
