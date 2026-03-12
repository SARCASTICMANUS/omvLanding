from django.contrib import admin
from core.models import University, Route, Stop, Vehicle, StudentAssignment, ActiveTrip
from django.contrib.auth import get_user_model

User = get_user_model()


@admin.register(University)
class UniversityAdmin(admin.ModelAdmin):
    list_display = ("id", "name", "created_at")
    search_fields = ("name",)


@admin.register(Route)
class RouteAdmin(admin.ModelAdmin):
    list_display = ("id", "name", "university", "start_name", "end_name")
    list_filter = ("university",)
    search_fields = ("name", "start_name", "end_name")


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
        "vehicle",
        "route",
        "driver",
        "is_active",
        "start_time",
    )

    list_filter = (
        "is_active",
        "vehicle__vehicle_type",
    )

    search_fields = (
        "id",
        "driver__email",
        "vehicle__vehicle_number",
        "route__name",
    )

    readonly_fields = ("id", "start_time")


admin.site.register(User)
