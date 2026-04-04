# VAYY | core/admin.py | Status: ✅ Public Transport Refactor

from django.contrib import admin
from core.models import (
    City, Route, Stop, Vehicle,
    ActiveTrip, PublicPassengerProfile, PublicDriverProfile
)
from django.contrib.auth import get_user_model

User = get_user_model()


@admin.register(City)
class CityAdmin(admin.ModelAdmin):
    list_display = ("id", "name", "state", "country", "created_at")
    search_fields = ("name", "state", "country")


@admin.register(Route)
class RouteAdmin(admin.ModelAdmin):
    list_display = ("id", "name", "bus_number", "city", "start_name", "end_name", "is_public")
    list_filter = ("city", "is_public")
    search_fields = ("name", "bus_number", "start_name", "end_name")


@admin.register(Stop)
class StopAdmin(admin.ModelAdmin):
    list_display = ("id", "name", "route", "order")
    list_filter = ("route__city", "route")
    search_fields = ("name",)


@admin.register(Vehicle)
class VehicleAdmin(admin.ModelAdmin):
    list_display = ("id", "vehicle_number", "city", "vehicle_type", "driver")
    list_filter = ("city", "vehicle_type")
    search_fields = ("vehicle_number", "driver__email")


@admin.register(ActiveTrip)
class ActiveTripAdmin(admin.ModelAdmin):
    list_display = ("id", "driver", "route", "status", "started_at", "last_updated")
    list_filter = ("status",)
    search_fields = ("id", "driver__email", "route__name")
    readonly_fields = ("id", "started_at", "last_updated")


@admin.register(PublicPassengerProfile)
class PassengerProfileAdmin(admin.ModelAdmin):
    list_display = ("user", "display_name", "phone_number", "last_active_at")
    search_fields = ("user__email", "display_name", "phone_number")


@admin.register(PublicDriverProfile)
class DriverProfileAdmin(admin.ModelAdmin):
    list_display = ("user", "display_name", "license_number", "vehicle_type", "is_verified", "total_trips")
    list_filter = ("is_verified", "vehicle_type")
    search_fields = ("user__email", "display_name", "license_number")
    list_editable = ("is_verified",)


admin.site.register(User)
admin.site.site_header = "Vayy Public Transport Admin"
admin.site.site_title = "Vayy Admin"
