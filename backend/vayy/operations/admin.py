from django.contrib import admin

from operations.models import (
    Vehicle,
    VehicleState,
    ActiveTrip,
    TripRating,
    BoardingRequest,
)


@admin.register(Vehicle)
class VehicleAdmin(admin.ModelAdmin):
    list_display = (
        "id",
        "vehicle_number",
        "vehicle_type",
        "city",
        "route",
        "driver",
        "is_active",
        "created_at",
    )

    search_fields = (
        "vehicle_number",
    )

    list_filter = (
        "vehicle_type",
        "is_active",
        "city",
    )

    readonly_fields = (
        "created_at",
        "updated_at",
    )

    raw_id_fields = (
        "city",
        "route",
        "driver",
    )


@admin.register(VehicleState)
class VehicleStateAdmin(admin.ModelAdmin):
    list_display = (
        "id",
        "vehicle",
        "active_trip",
        "speed_kmph",
        "heading",
        "occupancy_count",
        "delay_minutes",
        "current_stop_index",
        "current_segment_index",
        "distance_along_route_m",
        "last_updated",
    )

    list_filter = (
        "vehicle__vehicle_type",
    )

    search_fields = (
        "vehicle__vehicle_number",
    )

    readonly_fields = (
        "last_updated",
    )

    raw_id_fields = (
        "vehicle",
        "active_trip",
    )

    fieldsets = (
        (
            "Vehicle & Trip",
            {
                "fields": (
                    "vehicle",
                    "active_trip",
                ),
            },
        ),
        (
            "Location",
            {
                "fields": (
                    "current_location",
                    "snapped_location",
                    "speed_kmph",
                    "heading",
                ),
            },
        ),
        (
            "Route State",
            {
                "fields": (
                    "current_stop_index",
                    "current_segment_index",
                    "distance_along_route_m",
                ),
            },
        ),
        (
            "Occupancy & Delay",
            {
                "fields": (
                    "occupancy_count",
                    "delay_minutes",
                ),
            },
        ),
        (
            "Timestamps",
            {
                "fields": ("last_updated",),
            },
        ),
    )


@admin.register(ActiveTrip)
class ActiveTripAdmin(admin.ModelAdmin):
    list_display = (
        "id",
        "route",
        "vehicle",
        "driver",
        "status",
        "direction",
        "current_stop",
        "current_segment_index",
        "started_at",
        "ended_at",
        "last_updated",
    )

    list_filter = (
        "status",
        "direction",
        "route",
    )

    search_fields = (
        "vehicle__vehicle_number",
        "driver__email",
        "route__name",
    )

    readonly_fields = (
        "started_at",
        "last_updated",
    )

    raw_id_fields = (
        "vehicle",
        "route",
        "driver",
        "trip_schedule",
        "current_stop",
    )

    fieldsets = (
        (
            "Trip Info",
            {
                "fields": (
                    "vehicle",
                    "route",
                    "driver",
                    "trip_schedule",
                ),
            },
        ),
        (
            "Status",
            {
                "fields": (
                    "status",
                    "direction",
                ),
            },
        ),
        (
            "Route State",
            {
                "fields": (
                    "current_stop",
                    "current_segment_index",
                    "current_location",
                ),
            },
        ),
        (
            "Timestamps",
            {
                "fields": (
                    "started_at",
                    "ended_at",
                    "last_updated",
                ),
            },
        ),
    )


@admin.register(TripRating)
class TripRatingAdmin(admin.ModelAdmin):
    list_display = (
        "id",
        "trip",
        "passenger",
        "driver",
        "rating",
        "created_at",
    )

    list_filter = (
        "rating",
    )

    search_fields = (
        "driver__email",
        "passenger__email",
    )

    readonly_fields = (
        "created_at",
    )

    raw_id_fields = (
        "trip",
        "passenger",
        "driver",
    )


@admin.register(BoardingRequest)
class BoardingRequestAdmin(admin.ModelAdmin):
    list_display = (
        "id",
        "passenger",
        "trip",
        "pickup_stop",
        "status",
        "created_at",
        "updated_at",
    )

    list_filter = (
        "status",
    )

    search_fields = (
        "passenger__email",
        "trip__vehicle__vehicle_number",
    )

    readonly_fields = (
        "created_at",
        "updated_at",
    )

    raw_id_fields = (
        "passenger",
        "trip",
        "pickup_stop",
    )
