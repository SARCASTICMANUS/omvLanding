# VAYY | core/api/serializers.py | Status: ✅ Public Transport Refactor

from rest_framework import serializers
from django.contrib.auth import get_user_model
from core.models import (
    City, Route, Stop, Vehicle,
    ActiveTrip, PublicPassengerProfile, PublicDriverProfile,
    BoardingRequest
)
from django.contrib.gis.geos import Point, LineString

User = get_user_model()


class CitySerializer(serializers.ModelSerializer):
    class Meta:
        model = City
        fields = ("id", "name", "state", "country", "created_at")


class StopSerializer(serializers.ModelSerializer):
    lat = serializers.FloatField(source="location.y")
    lon = serializers.FloatField(source="location.x")

    class Meta:
        model = Stop
        fields = ("id", "name", "lat", "lon", "order")


class RouteSerializer(serializers.ModelSerializer):
    stops = StopSerializer(many=True, read_only=True)
    path_coords = serializers.SerializerMethodField()
    stops_count = serializers.SerializerMethodField()
    city_name = serializers.CharField(source="city.name", read_only=True, default="")

    class Meta:
        model = Route
        fields = (
            "id",
            "city",
            "city_name",
            "name",
            "bus_number",
            "start_name",
            "end_name",
            "total_distance_meters",
            "is_public",
            "path_coords",
            "stops",
            "stops_count",
        )

    def get_path_coords(self, obj):
        return [[y, x] for x, y in obj.path.coords]

    def get_stops_count(self, obj):
        return obj.stops.count()


class PassengerProfileSerializer(serializers.ModelSerializer):
    class Meta:
        model = PublicPassengerProfile
        fields = (
            "id",
            "user",
            "display_name",
            "phone_number",
            "profile_photo",
            "last_active_at",
        )


class PublicDriverProfileSerializer(serializers.ModelSerializer):
    assigned_vehicle_number = serializers.SerializerMethodField()
    assigned_vehicle_id = serializers.SerializerMethodField()
    assigned_route_name = serializers.SerializerMethodField()

    class Meta:
        model = PublicDriverProfile
        fields = (
            "id",
            "user",
            "display_name",
            "phone_number",
            "license_number",
            "vehicle_number",
            "vehicle_type",
            "is_verified",
            "rating",
            "total_trips",
            "assigned_vehicle_number",
            "assigned_vehicle_id",
            "assigned_route_name",
        )

    def get_assigned_vehicle_number(self, obj):
        vehicle = getattr(obj.user, "assigned_vehicle", None)
        return vehicle.vehicle_number if vehicle else ""

    def get_assigned_vehicle_id(self, obj):
        vehicle = getattr(obj.user, "assigned_vehicle", None)
        return str(vehicle.id) if vehicle else ""

    def get_assigned_route_name(self, obj):
        vehicle = getattr(obj.user, "assigned_vehicle", None)
        if vehicle and vehicle.route:
            return vehicle.route.name
        return ""


class UserSerializer(serializers.ModelSerializer):
    city_name = serializers.CharField(source="city.name", read_only=True, default="")
    profile = serializers.SerializerMethodField()
    phone_number = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = (
            "id",
            "email",
            "first_name",
            "last_name",
            "role",
            "city",
            "city_name",
            "profile",
            "phone_number",
        )

    def get_profile(self, obj):
        if obj.role == "passenger" and hasattr(obj, "passenger_profile"):
            return PassengerProfileSerializer(obj.passenger_profile).data
        if obj.role == "driver" and hasattr(obj, "driver_profile"):
            return PublicDriverProfileSerializer(obj.driver_profile).data
        return None

    def get_phone_number(self, obj):
        if obj.role == "passenger" and hasattr(obj, "passenger_profile"):
            return obj.passenger_profile.phone_number
        if obj.role == "driver" and hasattr(obj, "driver_profile"):
            return obj.driver_profile.phone_number
        return ""

    def update(self, instance, validated_data):
        instance = super().update(instance, validated_data)
        return instance


class RegisterSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True)
    email = serializers.EmailField(validators=[])
    phone_number = serializers.CharField(required=False, allow_blank=True, default="")
    license_number = serializers.CharField(required=False, allow_null=True, allow_blank=True)
    vehicle_type = serializers.CharField(required=False, allow_blank=True, default="bus")

    class Meta:
        model = User
        fields = (
            "email",
            "password",
            "role",
            "city",
            "first_name",
            "last_name",
            "phone_number",
            "license_number",
            "vehicle_type",
        )

    def validate_email(self, value):
        user = User.objects.filter(email=value).first()
        if user and user.password != "" and user.has_usable_password():
            raise serializers.ValidationError("User with this email already exists.")
        return value

    def create(self, validated_data):
        email = validated_data["email"]
        phone = validated_data.pop("phone_number", "")
        license_number = validated_data.pop("license_number", None)
        v_type = validated_data.pop("vehicle_type", "bus")

        user = User.objects.filter(email=email).first()
        if user:
            user.set_password(validated_data["password"])
            user.role = validated_data.get("role", "passenger")
            user.city = validated_data.get("city")
            user.first_name = validated_data.get("first_name", "")
            user.last_name = validated_data.get("last_name", "")
            user.is_verified = True
            user.save()
        else:
            user = User.objects.create_user(
                username=email,
                email=email,
                password=validated_data["password"],
                role=validated_data.get("role", "passenger"),
                city=validated_data.get("city"),
                first_name=validated_data.get("first_name", ""),
                last_name=validated_data.get("last_name", ""),
                is_verified=True,
            )

        display_name = f"{user.first_name} {user.last_name}".strip() or user.email

        if user.role == "passenger":
            PublicPassengerProfile.objects.update_or_create(
                user=user,
                defaults={
                    "display_name": display_name,
                    "phone_number": phone,
                }
            )
        elif user.role == "driver":
            PublicDriverProfile.objects.update_or_create(
                user=user,
                defaults={
                    "display_name": display_name,
                    "phone_number": phone,
                    "license_number": license_number or None,
                    "vehicle_type": v_type,
                }
            )

        return user


class VehicleSerializer(serializers.ModelSerializer):
    driver_name = serializers.CharField(source="driver.get_full_name", read_only=True)
    route_name = serializers.CharField(source="route.name", read_only=True)
    city_name = serializers.CharField(source="city.name", read_only=True, default="")

    class Meta:
        model = Vehicle
        fields = (
            "id",
            "city",
            "city_name",
            "route",
            "route_name",
            "driver",
            "driver_name",
            "vehicle_number",
            "vehicle_type",
        )


class ActiveTripSerializer(serializers.ModelSerializer):
    route_name = serializers.CharField(source="route.name", read_only=True)
    bus_number = serializers.CharField(source="route.bus_number", read_only=True)
    delay_minutes = serializers.SerializerMethodField()

    class Meta:
        model = ActiveTrip
        fields = (
            "id",
            "driver",
            "route",
            "route_name",
            "bus_number",
            "status",
            "started_at",
            "last_updated",
            "delay_minutes",
        )

    def get_delay_minutes(self, obj):
        if obj.vehicle and hasattr(obj.vehicle, "state"):
            return obj.vehicle.state.delay_minutes
        return 0


class BoardingRequestSerializer(serializers.ModelSerializer):
    passenger_name = serializers.CharField(source="passenger.get_full_name", read_only=True)
    stop_name = serializers.CharField(source="pickup_stop.name", read_only=True)
    trip_bus_number = serializers.CharField(source="trip.route.bus_number", read_only=True)

    class Meta:
        model = BoardingRequest
        fields = (
            "id",
            "passenger",
            "passenger_name",
            "trip",
            "trip_bus_number",
            "pickup_stop",
            "stop_name",
            "status",
            "created_at",
        )
        read_only_fields = ("passenger", "status")


class OTPSerializer(serializers.Serializer):
    email = serializers.EmailField()
    otp = serializers.CharField(max_length=6, required=False)


# ─── Bulk Import Serializers ──────────────────────────────────────────────────

class ImportStopSerializer(serializers.Serializer):
    name = serializers.CharField(max_length=255)
    lat = serializers.FloatField()
    lon = serializers.FloatField()
    order = serializers.IntegerField(default=0)


class ImportStopTimeSerializer(serializers.Serializer):
    stop_name = serializers.CharField(max_length=255)
    arrival_time = serializers.TimeField()


class ImportScheduleSerializer(serializers.Serializer):
    label = serializers.CharField(max_length=100)
    start_time = serializers.TimeField()
    stop_times = ImportStopTimeSerializer(many=True, required=False, default=[])


class ImportRouteSerializer(serializers.Serializer):
    name = serializers.CharField(max_length=255)
    bus_number = serializers.CharField(max_length=50, required=False, allow_blank=True, default="")
    city_id = serializers.UUIDField(required=False, allow_null=True)
    start_name = serializers.CharField(max_length=255, required=False, allow_blank=True, default="Start")
    end_name = serializers.CharField(max_length=255, required=False, allow_blank=True, default="End")
    is_public = serializers.BooleanField(default=True)
    stops = ImportStopSerializer(many=True)
    schedules = ImportScheduleSerializer(many=True, required=False, default=[])
