from django.contrib import admin

from operations.models import (
    Vehicle,
    VehicleState,
    ActiveTrip,
    BoardingRequest,
)


@admin.register(Vehicle)
class VehicleAdmin(
    admin.ModelAdmin
):
    list_display = (
        "vehicle_number",
        "vehicle_type",
        "city",
        "driver",
        "is_active",
    )

    search_fields = (
        "vehicle_number",
    )


@admin.register(VehicleState)
class VehicleStateAdmin(
    admin.ModelAdmin
):
    list_display = (
        "vehicle",
        "delay_minutes",
        "occupancy_count",
        "speed_kmph",
        "last_updated",
    )


@admin.register(ActiveTrip)
class ActiveTripAdmin(
    admin.ModelAdmin
):
    list_display = (
        "id",
        "route",
        "vehicle",
        "driver",
        "status",
        "started_at",
    )

    list_filter = (
        "status",
    )


@admin.register(BoardingRequest)
class BoardingRequestAdmin(
    admin.ModelAdmin
):
    list_display = (
        "id",
        "passenger",
        "trip",
        "status",
        "created_at",
    )

    list_filter = (
        "status",
    )