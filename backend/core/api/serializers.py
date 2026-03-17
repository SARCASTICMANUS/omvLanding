# VAYY | core/api/serializers.py | Status: 🔧 Fixed
# Reason: Added StudentProfileSerializer, DriverProfileSerializer, boarding_eligible field,
#         role-based embedded profiles in UserSerializer.

from rest_framework import serializers
from django.contrib.auth import get_user_model
from django.utils import timezone
from core.models import (
    University, Route, Stop, Vehicle, StudentAssignment,
    ActiveTrip, StudentProfile, DriverProfile, BulkUploadLog
)
from django.contrib.gis.geos import Point, LineString

User = get_user_model()


class UniversitySerializer(serializers.ModelSerializer):
    class Meta:
        model = University
        fields = "__all__"


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

    class Meta:
        model = Route
        fields = (
            "id",
            "university",
            "name",
            "bus_number",
            "start_name",
            "end_name",
            "total_distance_meters",
            "path_coords",
            "stops",
            "stops_count",
        )

    def get_path_coords(self, obj):
        return [[y, x] for x, y in obj.path.coords]

    def get_stops_count(self, obj):
        return obj.stops.count()


class StudentProfileSerializer(serializers.ModelSerializer):
    boarding_eligible = serializers.SerializerMethodField()
    assigned_vehicle_number = serializers.SerializerMethodField()
    assigned_route_name = serializers.SerializerMethodField()
    pickup_lat = serializers.SerializerMethodField()
    pickup_lon = serializers.SerializerMethodField()

    class Meta:
        model = StudentProfile
        fields = (
            "id",
            "user",
            "student_name",
            "student_id",
            "bus_pass_id",
            "bus_pass_validity",
            "phone_number",
            "home_address",
            "assigned_vehicle_number",
            "assigned_route_name",
            "boarding_eligible",
            "pickup_lat",
            "pickup_lon",
        )

    def get_boarding_eligible(self, obj):
        if not obj.bus_pass_validity:
            return False
        return obj.bus_pass_validity >= timezone.now().date()

    def get_assigned_vehicle_number(self, obj):
        assignment = obj.user.vehicle_assignments.first()
        return assignment.vehicle.vehicle_number if assignment else None

    def get_assigned_route_name(self, obj):
        assignment = obj.user.vehicle_assignments.first()
        if assignment and assignment.vehicle.route:
            return assignment.vehicle.route.name
        return ""

    def get_pickup_lat(self, obj):
        return obj.pickup_stop.y if obj.pickup_stop else None

    def get_pickup_lon(self, obj):
        return obj.pickup_stop.x if obj.pickup_stop else None


class DriverProfileSerializer(serializers.ModelSerializer):
    assigned_vehicle_number = serializers.SerializerMethodField()
    assigned_route_name = serializers.SerializerMethodField()

    class Meta:
        model = DriverProfile
        fields = (
            "id",
            "user",
            "driver_name",
            "license_number",
            "vehicle_number",
            "vehicle_type",
            "assigned_vehicle_number",
            "assigned_route_name",
        )

    def get_assigned_vehicle_number(self, obj):
        vehicle = getattr(obj.user, "assigned_vehicle", None)
        return vehicle.vehicle_number if vehicle else ""

    def get_assigned_route_name(self, obj):
        vehicle = getattr(obj.user, "assigned_vehicle", None)
        if vehicle and vehicle.route:
            return vehicle.route.name
        return ""


class UserSerializer(serializers.ModelSerializer):
    university_name = serializers.CharField(source="university.name", read_only=True, default="")
    profile = serializers.SerializerMethodField()
    boarding_eligible = serializers.SerializerMethodField()
    
    # Virtual fields for StudentProfile sync
    student_id = serializers.CharField(source="student_profile.student_id", required=False, allow_null=True)
    bus_pass_id = serializers.CharField(source="student_profile.bus_pass_id", required=False, allow_null=True)
    bus_pass_validity = serializers.DateField(source="student_profile.bus_pass_validity", required=False, allow_null=True)
    phone_number = serializers.CharField(source="student_profile.phone_number", required=False, allow_blank=True)

    class Meta:
        model = User
        fields = (
            "id",
            "email",
            "first_name",
            "last_name",
            "role",
            "university",
            "university_name",
            "profile",
            "boarding_eligible",
            "student_id",
            "bus_pass_id",
            "bus_pass_validity",
            "phone_number",
        )
    
    def update(self, instance, validated_data):
        # Extract student profile nested data if present
        profile_data = validated_data.pop("student_profile", None)
        
        # Update User
        instance = super().update(instance, validated_data)
        
        # Update or Create StudentProfile if user is a student
        if instance.role == "student" and profile_data:
            fullName = f"{instance.first_name} {instance.last_name}".strip() or instance.email
            StudentProfile.objects.update_or_create(
                user=instance,
                defaults={
                    "student_name": fullName,
                    **profile_data
                }
            )
        return instance

    def get_profile(self, obj):
        if obj.role == "student" and hasattr(obj, "student_profile"):
            return StudentProfileSerializer(obj.student_profile).data
        if obj.role == "driver" and hasattr(obj, "driver_profile"):
            return DriverProfileSerializer(obj.driver_profile).data
        return None

    def get_boarding_eligible(self, obj):
        if obj.role != "student":
            return None
        if hasattr(obj, "student_profile") and obj.student_profile.bus_pass_validity:
            return obj.student_profile.bus_pass_validity >= timezone.now().date()
        return False


class RegisterSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True)
    # Remove default validators so we can check it manually in validate_email
    email = serializers.EmailField(validators=[])
    student_id = serializers.CharField(required=False, allow_null=True)
    bus_pass_id = serializers.CharField(required=False, allow_null=True)
    bus_pass_validity = serializers.DateField(required=False, allow_null=True)
    phone_number = serializers.CharField(required=False, allow_blank=True)

    class Meta:
        model = User
        fields = (
            "email",
            "password",
            "role",
            "university",
            "first_name",
            "last_name",
            "student_id",
            "bus_pass_id",
            "bus_pass_validity",
            "phone_number",
        )

    def validate_email(self, value):
        user = User.objects.filter(email=value).first()
        # Django considers "" to be a "usable" password artificially. We only block
        # if the password is truly hashed and set.
        if user and user.password != "" and user.has_usable_password():
            raise serializers.ValidationError("User with this email already exists.")
        return value

    def create(self, validated_data):
        email = validated_data["email"]
        user = User.objects.filter(email=email).first()
        if user:
            user.set_password(validated_data["password"])
            user.role = validated_data.get("role", "student")
            user.university = validated_data.get("university")
            user.first_name = validated_data.get("first_name", "")
            user.last_name = validated_data.get("last_name", "")
            user.is_verified = True
            user.save()
        else:
            user = User.objects.create_user(
                username=email,
                email=email,
                password=validated_data["password"],
                role=validated_data.get("role", "student"),
                university=validated_data.get("university"),
                first_name=validated_data.get("first_name", ""),
                last_name=validated_data.get("last_name", ""),
                is_verified=True,
            )

        # Create Profile
        if user.role == "student":
            fullName = f"{user.first_name} {user.last_name}".strip() or user.email
            StudentProfile.objects.update_or_create(
                user=user,
                defaults={
                    "student_name": fullName,
                    "student_id": validated_data.get("student_id"),
                    "bus_pass_id": validated_data.get("bus_pass_id"),
                    "bus_pass_validity": validated_data.get("bus_pass_validity"),
                    "phone_number": validated_data.get("phone_number", ""),
                }
            )
        elif user.role == "driver":
            DriverProfile.objects.get_or_create(user=user)

        return user


class VehicleSerializer(serializers.ModelSerializer):
    driver_name = serializers.CharField(source="driver.get_full_name", read_only=True)
    route_name = serializers.CharField(source="route.name", read_only=True)

    class Meta:
        model = Vehicle
        fields = (
            "id",
            "university",
            "route",
            "route_name",
            "driver",
            "driver_name",
            "vehicle_number",
            "vehicle_type",
        )


class StudentAssignmentSerializer(serializers.ModelSerializer):
    student_name = serializers.CharField(source="student.get_full_name", read_only=True)
    student_id = serializers.CharField(source="student.student_profile.student_id", read_only=True)
    vehicle_number = serializers.CharField(
        source="vehicle.vehicle_number", read_only=True
    )

    class Meta:
        model = StudentAssignment
        fields = ("id", "student", "student_name", "student_id", "vehicle", "vehicle_number")


class ActiveTripSerializer(serializers.ModelSerializer):
    route_name = serializers.CharField(source="route.name", read_only=True)
    bus_number = serializers.CharField(source="route.bus_number", read_only=True)

    class Meta:
        model = ActiveTrip
        fields = ("id", "driver", "route", "route_name", "bus_number", "status", "started_at", "last_updated")


class OTPSerializer(serializers.Serializer):
    email = serializers.EmailField()
    otp = serializers.CharField(max_length=6, required=False)


class BulkUploadLogSerializer(serializers.ModelSerializer):
    class Meta:
        model = BulkUploadLog
        fields = "__all__"
