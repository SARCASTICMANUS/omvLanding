from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as DjangoUserAdmin

from .models import (
    User,
    PublicPassengerProfile,
    PublicDriverProfile,
    Wallet,
    Transaction,
    PaymentMethod,
    DriverDocument,
    RecentSearch,
    DriverBankDetail,
)


@admin.register(User)
class UserAdmin(DjangoUserAdmin):
    list_display = (
        "id",
        "email",
        "role",
        "city",
        "is_verified",
        "is_staff",
        "is_active",
        "date_joined",
    )

    list_filter = (
        "role",
        "is_verified",
        "is_staff",
        "is_superuser",
        "is_active",
        "city",
    )

    search_fields = (
        "email",
        "username",
        "first_name",
        "last_name",
    )

    ordering = ("-date_joined",)

    readonly_fields = (
        "last_login",
        "date_joined",
    )

    fieldsets = (
        (
            "Authentication",
            {
                "fields": (
                    "email",
                    "username",
                    "password",
                )
            },
        ),
        (
            "Personal Info",
            {
                "fields": (
                    "first_name",
                    "last_name",
                )
            },
        ),
        (
            "Roles & Verification",
            {
                "fields": (
                    "role",
                    "city",
                    "is_verified",
                    "otp_verified",
                )
            },
        ),
        (
            "Legacy Driver Fields",
            {
                "fields": (
                    "vehicle_type",
                    "vehicle_number",
                )
            },
        ),
        (
            "Permissions",
            {
                "fields": (
                    "is_active",
                    "is_staff",
                    "is_superuser",
                    "groups",
                    "user_permissions",
                )
            },
        ),
        (
            "Important Dates",
            {
                "fields": (
                    "last_login",
                    "date_joined",
                )
            },
        ),
    )

    add_fieldsets = (
        (
            None,
            {
                "classes": ("wide",),
                "fields": (
                    "email",
                    "password1",
                    "password2",
                    "role",
                    "is_staff",
                    "is_active",
                ),
            },
        ),
    )


@admin.register(PublicPassengerProfile)
class PublicPassengerProfileAdmin(admin.ModelAdmin):
    list_display = (
        "id",
        "user",
        "display_name",
        "phone_number",
        "last_active_at",
    )

    search_fields = (
        "user__email",
        "display_name",
        "phone_number",
    )

    autocomplete_fields = (
        "user",
        "saved_routes",
    )

    readonly_fields = (
        "last_active_at",
    )


@admin.register(PublicDriverProfile)
class PublicDriverProfileAdmin(admin.ModelAdmin):
    list_display = (
        "id",
        "user",
        "display_name",
        "vehicle_type",
        "vehicle_number",
        "is_verified",
        "rating",
        "total_trips",
    )

    list_filter = (
        "vehicle_type",
        "is_verified",
    )

    search_fields = (
        "user__email",
        "display_name",
        "license_number",
        "vehicle_number",
    )

    autocomplete_fields = (
        "user",
    )

    readonly_fields = (
        "rating",
        "total_trips",
    )


@admin.register(Wallet)
class WalletAdmin(admin.ModelAdmin):
    list_display = (
        "id",
        "user",
        "balance",
        "currency",
        "is_active",
        "created_at",
    )

    list_filter = (
        "currency",
        "is_active",
    )

    search_fields = (
        "user__email",
    )

    readonly_fields = (
        "created_at",
        "updated_at",
    )


@admin.register(Transaction)
class TransactionAdmin(admin.ModelAdmin):
    list_display = (
        "id",
        "wallet",
        "amount",
        "type",
        "status",
        "reference",
        "created_at",
    )

    list_filter = (
        "type",
        "status",
    )

    search_fields = (
        "wallet__user__email",
        "reference",
    )

    readonly_fields = (
        "created_at",
        "updated_at",
    )


@admin.register(PaymentMethod)
class PaymentMethodAdmin(admin.ModelAdmin):
    list_display = (
        "id",
        "user",
        "provider",
        "last_four",
        "is_default",
        "created_at",
    )

    list_filter = (
        "provider",
        "is_default",
    )

    search_fields = (
        "user__email",
        "provider",
    )

    readonly_fields = (
        "created_at",
        "updated_at",
    )


@admin.register(DriverDocument)
class DriverDocumentAdmin(admin.ModelAdmin):
    list_display = (
        "id",
        "driver",
        "document_type",
        "file_name",
        "status",
        "verified_by",
        "verified_at",
        "created_at",
    )

    list_filter = (
        "document_type",
        "status",
    )

    search_fields = (
        "driver__email",
        "file_name",
    )

    readonly_fields = (
        "created_at",
        "updated_at",
    )


@admin.register(RecentSearch)
class RecentSearchAdmin(admin.ModelAdmin):
    list_display = (
        "id",
        "user",
        "pickup_name",
        "destination_name",
        "created_at",
    )

    search_fields = (
        "user__email",
        "pickup_name",
        "destination_name",
    )

    readonly_fields = (
        "created_at",
    )


@admin.register(DriverBankDetail)
class DriverBankDetailAdmin(admin.ModelAdmin):
    list_display = (
        "id",
        "driver",
        "holder_name",
        "account_number",
        "ifsc",
        "upi",
        "created_at",
    )

    search_fields = (
        "driver__email",
        "holder_name",
        "account_number",
    )

    readonly_fields = (
        "created_at",
        "updated_at",
    )