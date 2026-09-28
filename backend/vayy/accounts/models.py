import uuid
from django.contrib.auth.models import AbstractUser
from django.contrib.auth import get_user_model
from django.db import models
from django.db.models import Q
from django.contrib.gis.db import models as gis_models

from .managers import UserManager
from common.constants import (
    ROLE_CHOICES, ROLE_PASSENGER, VEHICLE_TYPE_CHOICES, VEHICLE_AUTO,
    TX_TYPE_CHOICES, TX_STATUS_CHOICES, TX_STATUS_PENDING,
    DOC_TYPE_CHOICES, DOC_STATUS_CHOICES, DOC_STATUS_PENDING
)


class User(AbstractUser):
    email = models.EmailField(unique=True)
    role = models.CharField(
        max_length=20,
        choices=ROLE_CHOICES,
        default=ROLE_PASSENGER,
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
        default=VEHICLE_AUTO,
    )
    rc_number = models.CharField(
        max_length=50,
        default="",
        blank=True,
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
        constraints = [
            # Idempotency for wallet movements.
            #
            # `reference` is the natural key of a logical movement: a replayed
            # settlement must not debit a passenger twice. Postgres treats NULLs
            # as distinct, so NULL rows never collide; the explicit "" exclusion
            # is what keeps the historical `reference=""` default (callers that
            # pass no reference) from violating uniqueness on the second row.
            models.UniqueConstraint(
                fields=["reference"],
                condition=Q(reference__isnull=False) & ~Q(reference=""),
                name="uniq_transaction_reference_nonempty",
            ),
        ]


    class PaymentIntent(models.Model):
        """Payment intent for webhook-based fund addition.
    Only admin-created intents may be confirmed via webhook; direct POST amounts are rejected.
        """
        id = models.UUIDField(
            primary_key=True,
            default=uuid.uuid4,
            editable=False,
        )
        wallet = models.ForeignKey(
            Wallet,
            on_delete=models.CASCADE,
            related_name='payment_intents',
        )
        amount = models.DecimalField(
            max_digits=12,
            decimal_places=2,
        )
        status = models.CharField(
            max_length=20,
            default='pending',
            choices=[
                ('pending', 'Pending'),
                ('confirmed', 'Confirmed'),
                ('failed', 'Failed'),
            ],
        )
        client_secret = models.CharField(
            max_length=128,
            unique=True,
        )
        created_at = models.DateTimeField(
            auto_now_add=True,
        )
        confirmed_at = models.DateTimeField(
            null=True,
            blank=True,
        )

        class Meta:
            ordering = ['-created_at']

        def __str__(self):
            return f'PaymentIntent {self.id} - {self.status} (RS{self.amount})'

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


class PaymentOrder(models.Model):
    """
    Server-side record of a wallet top-up intent.

    This row is the authority for how much a wallet may be credited. A wallet
    is only ever credited from here, and only after a gateway webhook has been
    HMAC-verified and its amount matched against `amount` below. Never credit a
    wallet from a client-supplied amount.
    """

    STATUS_PENDING = "pending"
    STATUS_PROCESSING = "processing"
    STATUS_SUCCEEDED = "succeeded"
    STATUS_FAILED = "failed"
    STATUS_CHOICES = (
        (STATUS_PENDING, "Pending"),
        (STATUS_PROCESSING, "Processing"),
        (STATUS_SUCCEEDED, "Succeeded"),
        (STATUS_FAILED, "Failed"),
    )

    # Statuses from which no further transition is allowed.
    TERMINAL_STATUSES = (STATUS_SUCCEEDED, STATUS_FAILED)

    # Flat tuple of every legal status value, used to reject unknown webhook
    # input instead of silently coercing it into a valid status.
    ALL_STATUSES = (
        STATUS_PENDING,
        STATUS_PROCESSING,
        STATUS_SUCCEEDED,
        STATUS_FAILED,
    )

    id = models.UUIDField(
        primary_key=True,
        default=uuid.uuid4,
        editable=False,
    )
    # Server-generated public identifier handed to the gateway. Deliberately
    # not a bare UUID so it cannot be confused with, or enumerated as, a PK.
    order_id = models.CharField(
        max_length=64,
        unique=True,
        editable=False,
    )
    # Client-supplied replay key, unique so a retried create is a no-op rather
    # than a second order.
    idempotency_key = models.CharField(
        max_length=128,
        unique=True,
    )
    user = models.ForeignKey(
        UserModel,
        on_delete=models.CASCADE,
        related_name="payment_orders",
    )
    amount = models.DecimalField(
        max_digits=12,
        decimal_places=2,
    )
    currency = models.CharField(
        max_length=10,
        default="INR",
    )
    status = models.CharField(
        max_length=20,
        choices=STATUS_CHOICES,
        default=STATUS_PENDING,
        db_index=True,
    )
    gateway = models.CharField(
        max_length=50,
        blank=True,
        null=True,
    )
    gateway_payment_id = models.CharField(
        max_length=128,
        blank=True,
        null=True,
    )
    # Retained for dispute/audit so a signature can be re-verified later.
    gateway_signature = models.CharField(
        max_length=256,
        blank=True,
        null=True,
    )
    failure_reason = models.CharField(
        max_length=255,
        blank=True,
        null=True,
    )
    # The credit this order produced. OneToOne is the last line of defence
    # against double-crediting even if the status guard were bypassed.
    wallet_transaction = models.OneToOneField(
        Transaction,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="payment_order",
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
    paid_at = models.DateTimeField(
        null=True,
        blank=True,
    )

    class Meta:
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["status", "created_at"]),
            models.Index(fields=["user", "status"]),
        ]
        constraints = [
            # A gateway payment id may only ever settle one order.
            models.UniqueConstraint(
                fields=["gateway", "gateway_payment_id"],
                condition=Q(gateway_payment_id__isnull=False),
                name="accounts_paymentorder_gateway_payment_uniq",
            ),
            models.CheckConstraint(
                condition=Q(amount__gt=0),
                name="accounts_paymentorder_amount_positive",
            ),
        ]

    def __str__(self):
        return f"PaymentOrder {self.order_id} ({self.amount} {self.currency}, {self.status})"

    def save(self, *args, **kwargs):
        if not self.order_id:
            self.order_id = f"po_{uuid.uuid4().hex}"
        super().save(*args, **kwargs)


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
    doc_key = models.CharField(
        max_length=50,
        default="",
        blank=True,
        help_text="Unique slot key (e.g. dlFront, rcBack) for create-or-update",
    )
    file_data = models.TextField(
        default="",
        blank=True,
        help_text="Base64-encoded file content",
    )
    file_name = models.CharField(
        max_length=255,
        default="upload.jpg",
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
            models.Index(fields=["driver", "doc_key"]),
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
