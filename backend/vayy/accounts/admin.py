from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as DjangoUserAdmin

from .models import (
    User,
    PublicPassengerProfile,
    PublicDriverProfile,
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