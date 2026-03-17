# VAYY | core/admin.py | Status: 🔧 Fixed
# Reason: Updated ActiveTripAdmin to use new fields: status, started_at (renamed from start_time)
#         Added StudentProfile, DriverProfile, BulkUploadLog to admin.

from django.contrib import admin
from core.models import (
    University, Route, Stop, Vehicle, StudentAssignment,
    ActiveTrip, StudentProfile, DriverProfile, BulkUploadLog
)
from django.contrib.auth import get_user_model

User = get_user_model()


@admin.register(University)
class UniversityAdmin(admin.ModelAdmin):
    list_display = ("id", "name", "created_at")
    search_fields = ("name",)


@admin.register(Route)
class RouteAdmin(admin.ModelAdmin):
    list_display = ("id", "name", "bus_number", "university", "start_name", "end_name")
    list_filter = ("university",)
    search_fields = ("name", "bus_number", "start_name", "end_name")


@admin.register(Stop)
class StopAdmin(admin.ModelAdmin):
    list_display = ("id", "name", "route", "order")
    list_filter = ("route__university", "route")
    search_fields = ("name",)


@admin.register(Vehicle)
class VehicleAdmin(admin.ModelAdmin):
    list_display = ("id", "vehicle_number", "university", "vehicle_type", "driver")
    list_filter = ("university", "vehicle_type")
    search_fields = ("vehicle_number", "driver__email")


@admin.register(StudentAssignment)
class StudentAssignmentAdmin(admin.ModelAdmin):
    list_display = ("id", "student", "vehicle", "assigned_at")
    list_filter = ("vehicle__university",)


@admin.register(ActiveTrip)
class ActiveTripAdmin(admin.ModelAdmin):
    list_display = (
        "id",
        "driver",
        "route",
        "status",
        "started_at",
        "last_updated",
    )
    list_filter = ("status",)
    search_fields = (
        "id",
        "driver__email",
        "route__name",
    )
    readonly_fields = ("id", "started_at", "last_updated")


@admin.register(StudentProfile)
class StudentProfileAdmin(admin.ModelAdmin):
    list_display = ("user", "student_name", "student_id", "bus_pass_id", "bus_pass_validity")
    search_fields = ("user__email", "student_name", "student_id")


@admin.register(DriverProfile)
class DriverProfileAdmin(admin.ModelAdmin):
    list_display = ("user", "driver_name", "license_number", "vehicle_number", "vehicle_type")
    search_fields = ("user__email", "driver_name", "license_number")


@admin.register(BulkUploadLog)
class BulkUploadLogAdmin(admin.ModelAdmin):
    list_display = ("id", "uploaded_by", "file_name", "total_rows", "success_count", "error_count", "created_at")
    readonly_fields = ("errors",)


admin.site.register(User)
