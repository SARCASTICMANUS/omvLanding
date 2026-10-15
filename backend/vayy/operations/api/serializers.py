from rest_framework import serializers

from operations.models import (
    Vehicle,
    VehicleState,
    ActiveTrip,
    BoardingRequest,
    TripRating,
    FareConfiguration,
)
from operations.selectors.trip_selector import TripSelector
from transport.models import (
    Route,
    Stop,
    TripSchedule,
)
from common.constants import VEHICLE_TYPE_CHOICES, VEHICLE_TYPE_AUTO, DISPATCH_MODE_DIRECT, DISPATCH_MODE_BROADCAST

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
            "status",
            "is_active",
            "created_at",
            "updated_at",
        )
        read_only_fields = ("id", "status", "created_at", "updated_at")


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
    otp = serializers.CharField(
        read_only=True
    )
    pickup_name = serializers.CharField(
        source="route.start_name",
        read_only=True,
        default="",
    )
    destination_name = serializers.CharField(
        source="route.end_name",
        read_only=True,
        default="",
    )

    # Computed fields for frontend trip history display
    pickup_name = serializers.SerializerMethodField()
    destination_name = serializers.SerializerMethodField()
    distance_km = serializers.SerializerMethodField()
    duration_min = serializers.SerializerMethodField()
    date = serializers.SerializerMethodField()
    fare = serializers.SerializerMethodField()
    earnings = serializers.SerializerMethodField()

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
            "otp",
            "total_distance_m",
            "total_duration_s",
            "total_fare",
            "rating",
            "pickup_name",
            "destination_name",
            "distance_km",
            "duration_min",
            "date",
            "fare",
            "earnings",
        )

    def get_pickup_name(self, obj):
        """First stop name as pickup."""
        try:
            stops = obj.route.stops.order_by("order")
            first = stops.first()
            return first.name if first else obj.route.name
        except Exception:
            return obj.route.name if obj.route else "--"

    def get_destination_name(self, obj):
        """Last stop name as destination."""
        try:
            stops = obj.route.stops.order_by("order")
            last = stops.last()
            return last.name if last else obj.route.name
        except Exception:
            return obj.route.name if obj.route else "--"

    def get_distance_km(self, obj):
        if obj.total_distance_m is not None:
            return round(obj.total_distance_m / 1000, 1)
        return None

    def get_duration_min(self, obj):
        if obj.total_duration_s is not None:
            return round(obj.total_duration_s / 60, 1)
        return None

    def get_date(self, obj):
        dt = obj.ended_at or obj.started_at
        if dt:
            return dt.strftime("%b %d, %Y %I:%M %p")
        return None

    def get_fare(self, obj):
        if obj.total_fare is not None:
            return float(obj.total_fare)
        return None

    def get_earnings(self, obj):
        """Driver earnings = total fare (same as fare for now)."""
        if obj.total_fare is not None:
            return float(obj.total_fare)
        return None


class BoardingStopNameSerializer(
    serializers.ModelSerializer
):
    """Just enough of a stop to label a fare line."""

    class Meta:
        model = Stop

        fields = ("id", "name", "nearby_landmark")

        read_only_fields = fields


class BoardingRequestSerializer(
    serializers.ModelSerializer
):
    pickup_stop_detail = BoardingStopNameSerializer(
        source="pickup_stop", read_only=True
    )
    drop_stop_detail = BoardingStopNameSerializer(
        source="drop_stop", read_only=True
    )
    passenger_name = serializers.SerializerMethodField()

    class Meta:
        model = BoardingRequest

        fields = (
            "id",
            "passenger",
            "passenger_name",
            "trip",
            "pickup_stop",
            "pickup_stop_detail",
            "drop_stop",
            "drop_stop_detail",
            "status",
            "otp",
            "segment_distance_m",
            "segment_duration_s",
            "fare",
            "dropped_off_at",
            "created_at",
            "updated_at",
        )

        read_only_fields = (
            "id",
            "passenger",
            "status",
            "otp",
            "segment_distance_m",
            "segment_duration_s",
            "fare",
            "dropped_off_at",
            "created_at",
            "updated_at",
        )

    def get_passenger_name(self, obj) -> str:
        """
        The rider's display name, for the driver's fare screen.

        Read through the profile when present because that is the name shown to
        other riders; the account name is the fallback when a profile is missing.
        """
        user = obj.passenger
        profile = getattr(user, "passenger_profile", None)
        if profile and profile.display_name:
            return profile.display_name
        return user.get_full_name() or user.email


class FareConfigurationSerializer(serializers.ModelSerializer):
    class Meta:
        model = FareConfiguration
        fields = (
            "id",
            "vehicle_type",
            "base_fare",
            "per_km_rate",
            "effective_from",
            "is_active",
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
    drop_stop = serializers.UUIDField(required=False, allow_null=True)

    def validate(self, attrs):
        from common.constants import TRIP_STATUS_ACTIVE

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

        if trip.is_journey:
            # A journey has route_id = NULL, so filtering on route_id would
            # compile to `route_id IS NULL` and match *every* route-less stop --
            # including ones that belong to no journey and that this driver will
            # never pass. The set of stops a journey actually serves lives in
            # Redis (the ordered-stops document written at journey start), so
            # membership there is the only correct test.
            pickup_stop, drop_stop = self._resolve_journey_stops(
                trip,
                attrs.get("pickup_stop"),
                attrs.get("drop_stop"),
            )
        else:
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

            drop_stop_id = attrs.get("drop_stop")
            if drop_stop_id:
                drop_stop = Stop.objects.filter(
                    id=drop_stop_id,
                    route_id=trip.route_id,
                ).first()
                # Previously an unresolvable drop id silently became None, and
                # calculate_segment_fare(None, ...) returns 0.0 -- so a bad id
                # billed the passenger nothing instead of reporting the error.
                if not drop_stop:
                    raise serializers.ValidationError(
                        {
                            "drop_stop": (
                                "Drop stop not found "
                                "for this trip route."
                            )
                        }
                    )
            else:
                drop_stop = None

        attrs["trip"] = trip
        attrs["pickup_stop"] = pickup_stop
        attrs["drop_stop"] = drop_stop

        return attrs

    def _resolve_journey_stops(self, trip, pickup_stop_id, drop_stop_id):
        """
        Resolve and validate the pickup/drop stops of a journey hand-raise.

        Both must be global stops sitting on *this* journey's cached path, and
        the drop must come after the pickup along it -- otherwise the driver
        would be asked to drive backwards and the resulting pickup->drop segment
        fare would be nonsense.
        """
        from tracking.services.journey_cache_service import JourneyCacheService

        entries = JourneyCacheService.get_ordered_stops(str(trip.id))
        if not entries:
            # Either the journey never cached its stops, or the cache was lost.
            # Both are server-side faults: the driver's live screen is driven by
            # that same cache, so it is already unusable for this trip.
            raise serializers.ValidationError(
                {
                    "pickup_stop": (
                        "This journey's stops are no longer available. "
                        "Please try again shortly."
                    )
                }
            )

        by_id = {str(e["stop_id"]): e for e in entries}

        def _lookup(stop_id, field, label):
            entry = by_id.get(str(stop_id))
            if entry is None:
                raise serializers.ValidationError(
                    {
                        field: (
                            f"{label} is not a stop on this journey. "
                            "Choose one of the stops the driver is "
                            "passing."
                        )
                    }
                )
            stop = Stop.objects.filter(id=entry["stop_id"]).first()
            if stop is None:
                # Cached stop no longer exists in the database.
                raise serializers.ValidationError(
                    {
                        field: (
                            f"{label} is no longer available. "
                            "Please choose another stop."
                        )
                    }
                )
            return stop, entry

        pickup_stop, pickup_entry = _lookup(
            pickup_stop_id, "pickup_stop", "Pickup stop"
        )

        if drop_stop_id:
            drop_stop, drop_entry = _lookup(
                drop_stop_id, "drop_stop", "Drop stop"
            )
            if drop_entry["dist_along_m"] < pickup_entry["dist_along_m"]:
                raise serializers.ValidationError(
                    {
                        "drop_stop": (
                            "Drop stop must come after the pickup stop "
                            "on this journey."
                        )
                    }
                )
        else:
            drop_stop = None

        return pickup_stop, drop_stop


class DispatchRequestSerializer(serializers.Serializer):
    # route_id is set for legacy fixed-route dispatch. Journey-based hand raises
    # omit it and may pin the request to the journey card the passenger selected.
    route_id = serializers.UUIDField(required=False, allow_null=True, default=None)
    target_trip_id = serializers.UUIDField(required=False, allow_null=True, default=None)
    pickup_stop_id = serializers.UUIDField()
    drop_stop_id = serializers.UUIDField(required=False, allow_null=True)
    mode = serializers.ChoiceField(choices=[DISPATCH_MODE_DIRECT, DISPATCH_MODE_BROADCAST], default=DISPATCH_MODE_BROADCAST)


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
