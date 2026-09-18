import uuid
from django.contrib.auth.models import AbstractUser
from django.contrib.auth import get_user_model
from django.db import models
from django.contrib.gis.db import models as gis_models

from .managers import UserManager
from common.constants import (
    ROLE_CHOICES, VEHICLE_TYPE_CHOICES,
    TX_TYPE_CHOICES, TX_STATUS_CHOICES, TX_STATUS_PENDING,
    DOC_TYPE_CHOICES, DOC_STATUS_CHOICES, DOC_STATUS_PENDING
)


class User(AbstractUser):
    email = models.EmailField(unique=True)
    role = models.CharField(
        max_length=20,
        choices=ROLE_CHOICES,
        default="passenger",
        db_index=True,
    )
    city = models.ForeignKey(
        "transport.City",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="users",
    )

    # OTP Verification
    otp = models.CharField(max_length=6, null=True, blank=True)
    otp_verified = models.BooleanField(default=False)
    otp_created_at = models.DateTimeField(null=True, blank=True)

    is_verified = models.BooleanField(default=False)

    # Legacy Driver Fields
    vehicle_type = models.CharField(
        max_length=20,
        null=True,
        blank=True,
    )

    vehicle_number = models.CharField(
        max_length=20,
        null=True,
        blank=True,
    )

    push_token = models.CharField(
        max_length=255,
        null=True,
        blank=True,
        help_text="Expo push notification token",
    )

    USERNAME_FIELD = "email"
    REQUIRED_FIELDS = []

    objects = UserManager()
    class Meta:
        indexes = [
            models.Index(fields=["email"]),
            models.Index(fields=["role"]),
            models.Index(fields=["is_verified"]),
        ]
        verbose_name = "User"
        verbose_name_plural = "Users"

    def __str__(self):
        return self.email

UserModel = get_user_model()

class PublicPassengerProfile(models.Model):
    user = models.OneToOneField(
        UserModel,
        on_delete=models.CASCADE,
        related_name="passenger_profile",
    )

    display_name = models.CharField(
        max_length=255,
        default="",
        blank=True,
    )

    phone_number = models.CharField(
        max_length=20,
        default="",
        blank=True,
    )

    bio = models.TextField(
        default="",
        blank=True,
    )

    profile_photo = models.CharField(
        max_length=500,
        default="",
        blank=True,
    )

    home_location = gis_models.PointField(
        srid=4326,
        null=True,
        blank=True,
    )

    current_location = gis_models.PointField(
        srid=4326,
        null=True,
        blank=True,
    )

    last_active_at = models.DateTimeField(
        null=True,
        blank=True,
    )

    saved_routes = models.ManyToManyField(
        "transport.Route",
        blank=True,
        related_name="saved_by",
    )

    class Meta:
        indexes = [
            models.Index(fields=["last_active_at"]),
        ]
        verbose_name = "Passenger Profile"
        verbose_name_plural = "Passenger Profiles"

    def __str__(self):
        return f"PassengerProfile: {self.user.email}"


class PublicDriverProfile(models.Model):
    user = models.OneToOneField(
        UserModel,
        on_delete=models.CASCADE,
        related_name="driver_profile",
    )
    display_name = models.CharField(
        max_length=255,
        default="",
        blank=True,
    )
    phone_number = models.CharField(
        max_length=20,
        default="",
        blank=True,
    )
    bio = models.TextField(
        default="",
        blank=True,
    )
    license_number = models.CharField(
        max_length=100,
        unique=True,
        null=True,
        blank=True,
        default=None,
    )
    vehicle_number = models.CharField(
        max_length=50,
        default="",
        blank=True,
    )
    vehicle_type = models.CharField(
        max_length=20,
        choices=VEHICLE_TYPE_CHOICES,
        default="auto",
    )
    dob = models.DateField(
        null=True,
        blank=True,
    )
    gender = models.CharField(
        max_length=20,
        default="",
        blank=True,
    )
    is_verified = models.BooleanField(default=False)
    rating = models.FloatField(default=5.0)
    total_trips = models.PositiveIntegerField(default=0)

    class Meta:
        verbose_name = "Driver Profile"
        verbose_name_plural = "Driver Profiles"

    def __str__(self):
        return f"DriverProfile: {self.user.email}"


class Wallet(models.Model):
    id = models.UUIDField(
        primary_key=True,
        default=uuid.uuid4,
        editable=False,
    )
    user = models.OneToOneField(
        UserModel,
        on_delete=models.CASCADE,
        related_name="wallet",
    )
    balance = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        default=0.00,
    )
    currency = models.CharField(
        max_length=10,
        default="INR",
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

    def __str__(self):
        return f"Wallet: {self.user.email} ({self.balance} {self.currency})"


class Transaction(models.Model):
    id = models.UUIDField(
        primary_key=True,
        default=uuid.uuid4,
        editable=False,
    )
    wallet = models.ForeignKey(
        Wallet,
        on_delete=models.CASCADE,
        related_name="transactions",
    )
    amount = models.DecimalField(
        max_digits=12,
        decimal_places=2,
    )
    type = models.CharField(
        max_length=10,
        choices=TX_TYPE_CHOICES,
    )
    status = models.CharField(
        max_length=20,
        choices=TX_STATUS_CHOICES,
        default=TX_STATUS_PENDING,
    )
    reference = models.CharField(
        max_length=100,
        blank=True,
        null=True,
    )
    metadata = models.JSONField(
        default=dict,
        blank=True,
    )
    created_at = models.DateTimeField(
        auto_now_add=True,
    )
    updated_at = models.DateTimeField(
        auto_now=True,
    )

    class Meta:
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["status"]),
            models.Index(fields=["type"]),
            models.Index(fields=["created_at"]),
        ]


class PaymentMethod(models.Model):
    id = models.UUIDField(
        primary_key=True,
        default=uuid.uuid4,
        editable=False,
    )
    user = models.ForeignKey(
        UserModel,
        on_delete=models.CASCADE,
        related_name="payment_methods",
    )
    provider = models.CharField(
        max_length=50,
    )
    token = models.CharField(
        max_length=255,
    )
    last_four = models.CharField(
        max_length=4,
        blank=True,
        null=True,
    )
    is_default = models.BooleanField(
        default=False,
    )
    created_at = models.DateTimeField(
        auto_now_add=True,
    )
    updated_at = models.DateTimeField(
        auto_now=True,
    )


class DriverDocument(models.Model):
    id = models.UUIDField(
        primary_key=True,
        default=uuid.uuid4,
        editable=False,
    )
    driver = models.ForeignKey(
        UserModel,
        on_delete=models.CASCADE,
        related_name="documents",
    )
    document_type = models.CharField(
        max_length=20,
        choices=DOC_TYPE_CHOICES,
    )
    file = models.FileField(
        upload_to="driver_docs/",
    )
    status = models.CharField(
        max_length=20,
        choices=DOC_STATUS_CHOICES,
        default=DOC_STATUS_PENDING,
    )
    rejection_reason = models.TextField(
        blank=True,
        null=True,
    )
    verified_by = models.ForeignKey(
        UserModel,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="verified_docs",
    )
    verified_at = models.DateTimeField(
        null=True,
        blank=True,
    )
    created_at = models.DateTimeField(
        auto_now_add=True,
    )
    updated_at = models.DateTimeField(
        auto_now=True,
    )

    class Meta:
        indexes = [
            models.Index(fields=["status"]),
            models.Index(fields=["document_type"]),
        ]

class RecentSearch(models.Model):
    id = models.UUIDField(
        primary_key=True,
        default=uuid.uuid4,
        editable=False,
    )
    user = models.ForeignKey(
        UserModel,
        on_delete=models.CASCADE,
        related_name="recent_searches",
    )
    pickup_name = models.CharField(
        max_length=500,
        blank=True,
        default="",
    )
    pickup_lat = models.FloatField()
    pickup_lon = models.FloatField()
    destination_name = models.CharField(
        max_length=500,
        blank=True,
        default="",
    )
    destination_lat = models.FloatField()
    destination_lon = models.FloatField()
    created_at = models.DateTimeField(
        auto_now_add=True,
    )

    class Meta:
        ordering = ["-created_at"]
        verbose_name = "Recent Search"
        verbose_name_plural = "Recent Searches"

    def __str__(self):
        return f"{self.pickup_name} → {self.destination_name}"


class DriverBankDetail(models.Model):
    id = models.UUIDField(
        primary_key=True,
        default=uuid.uuid4,
        editable=False,
    )
    driver = models.OneToOneField(
        UserModel,
        on_delete=models.CASCADE,
        related_name="bank_detail",
    )
    holder_name = models.CharField(max_length=255, default="", blank=True)
    account_number = models.CharField(max_length=50, default="", blank=True)
    ifsc = models.CharField(max_length=20, default="", blank=True)
    upi = models.CharField(max_length=100, default="", blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "Driver Bank Detail"
        verbose_name_plural = "Driver Bank Details"

    def __str__(self):
        return f"BankDetail: {self.driver.email}"
