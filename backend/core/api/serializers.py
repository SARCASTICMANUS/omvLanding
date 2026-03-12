from rest_framework import serializers
from django.contrib.auth import get_user_model
from core.models import University, Route, Stop, Vehicle, StudentAssignment, ActiveTrip
from django.contrib.gis.geos import Point, LineString

User = get_user_model()


class UniversitySerializer(serializers.ModelSerializer):
    class Meta:
        model = University
        fields = "__all__"


class UserSerializer(serializers.ModelSerializer):
    university_name = serializers.CharField(source="university.name", read_only=True)

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
            "vehicle_type",
            "vehicle_number",
        )


class RegisterSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True)

    class Meta:
        model = User
        fields = (
            "email",
            "password",
            "role",
            "university",
            "first_name",
            "last_name",
        )

    def create(self, validated_data):
        user = User.objects.create_user(
            username=validated_data["email"],
            email=validated_data["email"],
            password=validated_data["password"],
            role=validated_data["role"],
            university=validated_data.get("university"),
            first_name=validated_data.get("first_name", ""),
            last_name=validated_data.get("last_name", ""),
            is_verified=True,
        )
        return user


class StopSerializer(serializers.ModelSerializer):
    lat = serializers.FloatField(source="location.y")
    lon = serializers.FloatField(source="location.x")

    class Meta:
        model = Stop
        fields = ("id", "name", "lat", "lon", "order")


class RouteSerializer(serializers.ModelSerializer):
    stops = StopSerializer(many=True, read_only=True)
    path_coords = serializers.SerializerMethodField()

    class Meta:
        model = Route
        fields = (
            "id",
            "university",
            "name",
            "start_name",
            "end_name",
            "total_distance_meters",
            "path_coords",
            "stops",
        )

    def get_path_coords(self, obj):
        return [[y, x] for x, y in obj.path.coords]


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
    vehicle_number = serializers.CharField(
        source="vehicle.vehicle_number", read_only=True
    )

    class Meta:
        model = StudentAssignment
        fields = ("id", "student", "student_name", "vehicle", "vehicle_number")


class ActiveTripSerializer(serializers.ModelSerializer):
    class Meta:
        model = ActiveTrip
        fields = "__all__"


class OTPSerializer(serializers.Serializer):
    email = serializers.EmailField()
    otp = serializers.CharField(max_length=6, required=False)
