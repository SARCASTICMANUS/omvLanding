from django.contrib.auth import authenticate
from rest_framework import serializers

from accounts.models import (
    User,
    PublicPassengerProfile,
    PublicDriverProfile,
    Wallet,
    Transaction,
    PaymentMethod,
    DriverDocument,
    RecentSearch,
)
from common.constants import ROLE_CHOICES

class UserSerializer(serializers.ModelSerializer):
    city_name = serializers.CharField(
        source="city.name",
        read_only=True,
    )
    class Meta:
        model = User
        fields = (
            "id",
            "email",
            "role",
            "is_staff",
            "city",
            "city_name",
            "is_verified",
            "first_name",
            "last_name",
            "date_joined",
        )
        read_only_fields = (
            "id",
            "is_verified",
            "date_joined",
        )


class CurrentUserUpdateSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = (
            "first_name",
            "last_name",
            "city",
        )

class RegisterSerializer(serializers.Serializer):
    email = serializers.EmailField()
    password = serializers.CharField(
        write_only=True,
        min_length=8,
    )
    role = serializers.ChoiceField(
        choices=ROLE_CHOICES
    )
    first_name = serializers.CharField(
        required=False,
        allow_blank=True,
    )
    last_name = serializers.CharField(
        required=False,
        allow_blank=True,
    )

    def validate_email(self, value):
        if User.objects.filter(email=value).exists():
            raise serializers.ValidationError(
                "User already exists."
            )
        return value

# LOGIN
class LoginSerializer(serializers.Serializer):
    email = serializers.EmailField()
    password = serializers.CharField(
        write_only=True
    )

    def validate(self, attrs):
        email = attrs.get("email")
        password = attrs.get("password")
        user = authenticate(
            username=email,
            password=password,
        )

        if not user:
            raise serializers.ValidationError(
                "Invalid credentials."
            )
        attrs["user"] = user
        return attrs

# OTP
class OTPSerializer(serializers.Serializer):
    email = serializers.EmailField()
    otp = serializers.CharField(
        min_length=6,
        max_length=6,
    )

# RESEND OTP
class ResendOTPSerializer(serializers.Serializer):
    email = serializers.EmailField()


# FORGOT PASSWORD
class ForgotPasswordSerializer(serializers.Serializer):
    email = serializers.EmailField()


# RESET PASSWORD
class ResetPasswordSerializer(serializers.Serializer):
    email = serializers.EmailField()

    otp = serializers.CharField(
        min_length=6,
        max_length=6,
    )
    password = serializers.CharField(
        min_length=8,
        write_only=True,
    )

# CHANGE PASSWORD
class ChangePasswordSerializer(serializers.Serializer):
    old_password = serializers.CharField(
        write_only=True,
    )
    new_password = serializers.CharField(
        write_only=True,
        min_length=8,
    )

# PASSENGER PROFILE
class PassengerProfileSerializer(serializers.ModelSerializer):
    email = serializers.EmailField(
        source="user.email",
        read_only=True,
    )

    class Meta:
        model = PublicPassengerProfile

        fields = (
            "id",
            "email",
            "display_name",
            "phone_number",
            "bio",
            "profile_photo",
            "home_location",
            "current_location",
            "last_active_at",
            "saved_routes",
        )

        read_only_fields = (
            "id",
            "last_active_at",
        )


# DRIVER PROFILE
class DriverProfileSerializer(serializers.ModelSerializer):
    email = serializers.EmailField(
        source="user.email",
        read_only=True,
    )

    class Meta:
        model = PublicDriverProfile

        fields = (
            "id",
            "email",
            "display_name",
            "phone_number",
            "bio",
            "license_number",
            "vehicle_number",
            "vehicle_type",
            "is_verified",
            "rating",
            "total_trips",
        )

        read_only_fields = (
            "id",
            "is_verified",
            "rating",
            "total_trips",
        )


# ── Merged serializers (User + Profile in one response) ─────


class MergedPassengerProfileSerializer(serializers.Serializer):
    """
    GET/PUT /me/passenger-profile/
    Returns User fields + PassengerProfile fields in one flat response.
    """
    # User fields
    id = serializers.UUIDField(source="user.id", read_only=True)
    email = serializers.EmailField(source="user.email", read_only=True)
    role = serializers.CharField(source="user.role", read_only=True)
    is_staff = serializers.BooleanField(source="user.is_staff", read_only=True)
    city = serializers.PrimaryKeyRelatedField(source="user.city", read_only=True)
    city_name = serializers.CharField(source="user.city.name", read_only=True, default=None)
    is_verified = serializers.BooleanField(source="user.is_verified", read_only=True)
    first_name = serializers.CharField(source="user.first_name")
    last_name = serializers.CharField(source="user.last_name")
    date_joined = serializers.DateTimeField(source="user.date_joined", read_only=True)

    # Profile fields
    profile_id = serializers.UUIDField(source="profile.id", read_only=True)
    display_name = serializers.CharField()
    phone_number = serializers.CharField()
    bio = serializers.CharField(required=False, allow_blank=True, default="")
    profile_photo = serializers.CharField(required=False, allow_blank=True, default="")
    home_location = serializers.SerializerMethodField()
    current_location = serializers.SerializerMethodField()
    last_active_at = serializers.DateTimeField(read_only=True)
    saved_routes = serializers.PrimaryKeyRelatedField(
        many=True, read_only=True,
    )

    class Meta:
        fields = (
            "id", "email", "role", "is_staff", "city", "city_name",
            "is_verified", "first_name", "last_name", "date_joined",
            "profile_id", "display_name", "phone_number", "bio",
            "profile_photo", "home_location", "current_location",
            "last_active_at", "saved_routes",
        )

    def get_home_location(self, obj):
        loc = obj.get("home_location_obj")
        if loc:
            return {"lat": loc.y, "lng": loc.x}
        return None

    def get_current_location(self, obj):
        loc = obj.get("current_location_obj")
        if loc:
            return {"lat": loc.y, "lng": loc.x}
        return None

    def to_representation(self, instance):
        data = super().to_representation(instance)
        data["id"] = str(instance["user"].id)
        data["profile_id"] = str(instance["profile"].id)
        data["saved_routes"] = [str(r.id) for r in instance.get("saved_routes_obj", [])]
        return data


class MergedPassengerProfileUpdateSerializer(serializers.Serializer):
    """
    PUT /me/passenger-profile/ — update both User + Profile fields.
    """
    first_name = serializers.CharField(required=False, allow_blank=True)
    last_name = serializers.CharField(required=False, allow_blank=True)
    city = serializers.UUIDField(required=False, allow_null=True)
    display_name = serializers.CharField(required=False, allow_blank=True)
    phone_number = serializers.CharField(required=False, allow_blank=True)
    bio = serializers.CharField(required=False, allow_blank=True)
    profile_photo = serializers.CharField(required=False, allow_blank=True)
    saved_routes = serializers.ListField(
        child=serializers.UUIDField(), required=False,
    )


class MergedDriverProfileSerializer(serializers.Serializer):
    """
    GET/PUT /me/driver-profile/
    Returns User fields + DriverProfile fields in one flat response.
    """
    # User fields
    id = serializers.UUIDField(source="user.id", read_only=True)
    email = serializers.EmailField(source="user.email", read_only=True)
    role = serializers.CharField(source="user.role", read_only=True)
    is_staff = serializers.BooleanField(source="user.is_staff", read_only=True)
    city = serializers.PrimaryKeyRelatedField(source="user.city", read_only=True)
    city_name = serializers.CharField(source="user.city.name", read_only=True, default=None)
    is_verified_user = serializers.BooleanField(source="user.is_verified", read_only=True)
    first_name = serializers.CharField(source="user.first_name")
    last_name = serializers.CharField(source="user.last_name")
    date_joined = serializers.DateTimeField(source="user.date_joined", read_only=True)

    # Profile fields
    profile_id = serializers.UUIDField(source="profile.id", read_only=True)
    display_name = serializers.CharField()
    phone_number = serializers.CharField()
    bio = serializers.CharField(required=False, allow_blank=True, default="")
    license_number = serializers.CharField(allow_null=True, allow_blank=True, default=None)
    vehicle_number = serializers.CharField(required=False, allow_blank=True, default="")
    vehicle_type = serializers.CharField()
    is_verified = serializers.BooleanField(read_only=True)
    rating = serializers.FloatField(read_only=True)
    total_trips = serializers.IntegerField(read_only=True)

    class Meta:
        fields = (
            "id", "email", "role", "is_staff", "city", "city_name",
            "is_verified_user", "first_name", "last_name", "date_joined",
            "profile_id", "display_name", "phone_number", "bio",
            "license_number", "vehicle_number", "vehicle_type",
            "is_verified", "rating", "total_trips",
        )

    def to_representation(self, instance):
        data = super().to_representation(instance)
        data["id"] = str(instance["user"].id)
        data["profile_id"] = str(instance["profile"].id)
        return data


class MergedDriverProfileUpdateSerializer(serializers.Serializer):
    """
    PUT /me/driver-profile/ — update both User + Profile fields.
    """
    first_name = serializers.CharField(required=False, allow_blank=True)
    last_name = serializers.CharField(required=False, allow_blank=True)
    city = serializers.UUIDField(required=False, allow_null=True)
    display_name = serializers.CharField(required=False, allow_blank=True)
    phone_number = serializers.CharField(required=False, allow_blank=True)
    bio = serializers.CharField(required=False, allow_blank=True)
    license_number = serializers.CharField(required=False, allow_null=True, allow_blank=True)
    vehicle_number = serializers.CharField(required=False, allow_blank=True)
    vehicle_type = serializers.CharField(required=False)


# DRIVER REGISTRATION
class DriverRegistrationSerializer(serializers.Serializer):
    display_name = serializers.CharField()
    phone_number = serializers.CharField()
    license_number = serializers.CharField()
    vehicle_number = serializers.CharField()
    vehicle_type = serializers.CharField()


# PASSENGER REGISTRATION
class PassengerRegistrationSerializer(serializers.Serializer):
    display_name = serializers.CharField()
    phone_number = serializers.CharField()
    bio = serializers.CharField(
        required=False,
        allow_blank=True,
    )

class WalletSerializer(serializers.ModelSerializer):
    class Meta:
        model = Wallet
        fields = ("id", "balance", "currency", "is_active", "updated_at")

class TransactionSerializer(serializers.ModelSerializer):
    class Meta:
        model = Transaction
        fields = ("id", "amount", "type", "status", "reference", "metadata", "created_at")

class AddFundsSerializer(serializers.Serializer):
    amount = serializers.DecimalField(max_digits=12, decimal_places=2, min_value=1.00)
    payment_method_id = serializers.CharField(required=False)

class PaymentMethodSerializer(serializers.ModelSerializer):
    class Meta:
        model = PaymentMethod
        fields = ("id", "provider", "last_four", "is_default", "created_at")

class DriverDocumentSerializer(serializers.ModelSerializer):
    class Meta:
        model = DriverDocument
        fields = ("id", "document_type", "file", "status", "rejection_reason", "created_at")
        read_only_fields = ("id", "status", "rejection_reason", "created_at")

class RecentSearchSerializer(serializers.ModelSerializer):
    pickup = serializers.SerializerMethodField()
    destination = serializers.SerializerMethodField()

    class Meta:
        model = RecentSearch
        fields = ("id", "pickup", "destination", "created_at")
        read_only_fields = ("id", "created_at")

    def get_pickup(self, obj):
        return {
            "lat": obj.pickup_lat,
            "lon": obj.pickup_lon,
            "name": obj.pickup_name,
            "display_name": obj.pickup_name,
        }

    def get_destination(self, obj):
        return {
            "lat": obj.destination_lat,
            "lon": obj.destination_lon,
            "name": obj.destination_name,
            "display_name": obj.destination_name,
        }

class RecentSearchCreateSerializer(serializers.Serializer):
    pickup_name = serializers.CharField(allow_blank=True, default="")
    pickup_lat = serializers.FloatField()
    pickup_lon = serializers.FloatField()
    destination_name = serializers.CharField(allow_blank=True, default="")
    destination_lat = serializers.FloatField()
    destination_lon = serializers.FloatField()
