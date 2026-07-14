from rest_framework import serializers

from operations.models import (
    Vehicle,
    VehicleState,
    ActiveTrip,
    BoardingRequest,
    TripRating,
)
from operations.selectors.trip_selector import TripSelector
from transport.models import (
    Route,
    Stop,
    TripSchedule,
)
from common.constants import VEHICLE_TYPE_CHOICES
from operations.constants import VEHICLE_TYPE_AUTO

class VehicleSerializer(
    serializers.ModelSerializer
):
    class Meta:
        model = Vehicle

        fields = (
            "id",
            "city",
            "route",
            "driver",
            "vehicle_number",
            "vehicle_type",
            "is_active",
            "created_at",
            "updated_at",
        )


class VehicleStateSerializer(
    serializers.ModelSerializer
):
    class Meta:
        model = VehicleState

        fields = (
            "active_trip",
            "delay_minutes",
            "occupancy_count",
            "speed_kmph",
            "heading",
            "last_updated",
        )


class TripRatingSerializer(serializers.ModelSerializer):
    class Meta:
        model = TripRating
        fields = ("id", "trip", "rating", "review", "created_at")
        read_only_fields = ("id", "created_at")


class ActiveTripSerializer(
    serializers.ModelSerializer
):
    vehicle = VehicleSerializer(
        read_only=True
    )
    route_name = serializers.CharField(
        source="route.name",
        read_only=True,
    )
    route_code = serializers.CharField(
        source="route.route_code",
        read_only=True,
    )
    vehicle_number = serializers.CharField(
        source="vehicle.vehicle_number",
        read_only=True,
    )
    vehicle_type = serializers.CharField(
        source="vehicle.vehicle_type",
        read_only=True,
    )
    city = serializers.UUIDField(
        source="vehicle.city_id",
        read_only=True,
    )
    rating = TripRatingSerializer(
        source="rating_record",
        read_only=True
    )

    class Meta:
        model = ActiveTrip

        fields = (
            "id",
            "vehicle",
            "vehicle_number",
            "vehicle_type",
            "route",
            "route_name",
            "route_code",
            "city",
            "trip_schedule",
            "driver",
            "status",
            "current_location",
            "started_at",
            "ended_at",
            "last_updated",
            "rating",
        )


class BoardingRequestSerializer(
    serializers.ModelSerializer
):
    class Meta:
        model = BoardingRequest

        fields = (
            "id",
            "passenger",
            "trip",
            "pickup_stop",
            "status",
            "created_at",
            "updated_at",
        )

        read_only_fields = (
            "id",
            "passenger",
            "status",
            "created_at",
            "updated_at",
        )


class StartTripSerializer(serializers.Serializer):
    vehicle_id = serializers.UUIDField(
        required=False
    )
    route_id = serializers.UUIDField()
    trip_schedule_id = serializers.UUIDField(
        required=False,
        allow_null=True,
    )

    def validate(self, attrs):
        route = (
            Route.objects
            .filter(
                id=attrs["route_id"]
            )
            .first()
        )

        if not route:
            raise serializers.ValidationError(
                {
                    "route_id": (
                        "Route not found."
                    )
                }
            )

        attrs["route"] = route

        trip_schedule_id = attrs.get(
            "trip_schedule_id"
        )
        if trip_schedule_id:
            schedule = (
                TripSchedule.objects
                .filter(
                    id=trip_schedule_id,
                    route=route,
                )
                .first()
            )

            if not schedule:
                raise serializers.ValidationError(
                    {
                        "trip_schedule_id": (
                            "Trip schedule not found "
                            "for this route."
                        )
                    }
                )

            attrs["trip_schedule"] = schedule
        else:
            attrs["trip_schedule"] = None

        return attrs


class BoardingRequestCreateSerializer(
    serializers.Serializer
):
    trip = serializers.UUIDField()
    pickup_stop = serializers.UUIDField()

    def validate(self, attrs):
        from operations.constants import TRIP_STATUS_ACTIVE

        trip_id = attrs["trip"]
        trip = None

        # 1. Try finding by ActiveTrip ID directly
        try:
            trip = TripSelector.get_active_trip(trip_id)
        except ActiveTrip.DoesNotExist:
            pass

        # 2. Fallback: find ActiveTrip by route_id
        if trip is None:
            trip = ActiveTrip.objects.filter(
                route_id=trip_id,
                status=TRIP_STATUS_ACTIVE,
            ).select_related(
                "vehicle", "route", "driver", "trip_schedule"
            ).first()

        if trip is None:
            raise serializers.ValidationError(
                {
                    "trip": (
                        "Active trip not found."
                    )
                }
            )

        pickup_stop = (
            Stop.objects
            .filter(
                id=attrs["pickup_stop"],
                route_id=trip.route_id,
            )
            .first()
        )

        if not pickup_stop:
            raise serializers.ValidationError(
                {
                    "pickup_stop": (
                        "Pickup stop not found "
                        "for this trip route."
                    )
                }
            )

        attrs["trip"] = trip
        attrs["pickup_stop"] = pickup_stop

        return attrs


class DispatchRequestSerializer(serializers.Serializer):
    route_id = serializers.UUIDField()
    pickup_stop_id = serializers.UUIDField()
    mode = serializers.ChoiceField(choices=["direct", "broadcast"], default="direct")


class DispatchAssignSerializer(serializers.Serializer):
    vehicle_id = serializers.UUIDField()
    driver_id = serializers.UUIDField()
    route_id = serializers.UUIDField()
    trip_schedule_id = serializers.UUIDField(required=False, allow_null=True)


class DispatchCancelSerializer(serializers.Serializer):
    reason = serializers.CharField(required=False, default="user_cancelled")


class RideEstimateSerializer(serializers.Serializer):
    pickup_lat = serializers.FloatField()
    pickup_lng = serializers.FloatField()
    drop_lat = serializers.FloatField()
    drop_lng = serializers.FloatField()
    vehicle_type = serializers.ChoiceField(choices=VEHICLE_TYPE_CHOICES, default=VEHICLE_TYPE_AUTO)


class RideEstimateResponseSerializer(serializers.Serializer):
    distance_km = serializers.FloatField()
    duration_minutes = serializers.FloatField()
    estimated_fare = serializers.FloatField()
    surge_multiplier = serializers.FloatField()
    vehicle_type = serializers.CharField()
