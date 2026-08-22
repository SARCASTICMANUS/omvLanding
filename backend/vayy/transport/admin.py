from django.contrib import admin

from transport.models import (
    City,
    Route,
    Stop,
    TripSchedule,
    StopTime,
)


@admin.register(City)
class CityAdmin(admin.ModelAdmin):
    list_display = (
        "id",
        "name",
        "state",
        "country",
        "created_at",
    )

    search_fields = (
        "name",
        "state",
    )

    readonly_fields = (
        "created_at",
    )


class StopInline(admin.TabularInline):
    model = Stop
    extra = 0
    fields = (
        "order",
        "name",
        "location",
        "geometry",
        "cumulative_distance_m",
        "cumulative_duration_s",
    )
    ordering = ("order",)


class ScheduleInline(admin.TabularInline):
    model = TripSchedule
    extra = 0
    fields = (
        "label",
        "scheduled_start_time",
        "is_active",
    )


@admin.register(Route)
class RouteAdmin(admin.ModelAdmin):
    list_display = (
        "id",
        "name",
        "city",
        "route_code",
        "start_name",
        "end_name",
        "total_distance_meters",
        "is_public",
    )

    search_fields = (
        "name",
        "route_code",
    )

    list_filter = (
        "city",
        "is_public",
    )

    readonly_fields = (
        "created_at",
        "updated_at",
    )

    inlines = [
        StopInline,
        ScheduleInline,
    ]


@admin.register(Stop)
class StopAdmin(admin.ModelAdmin):
    list_display = (
        "id",
        "name",
        "route",
        "order",
        "cumulative_distance_m",
        "cumulative_duration_s",
    )

    list_filter = (
        "route",
    )

    search_fields = (
        "name",
    )

    ordering = ("route", "order")

    fields = (
        "route",
        "name",
        "location",
        "order",
        "geometry",
        "cumulative_distance_m",
        "cumulative_duration_s",
    )


class StopTimeInline(admin.TabularInline):
    model = StopTime
    extra = 0
    fields = (
        "stop",
        "stop_sequence",
        "arrival_time",
    )
    ordering = ("stop_sequence",)


@admin.register(TripSchedule)
class TripScheduleAdmin(admin.ModelAdmin):
    list_display = (
        "id",
        "route",
        "label",
        "scheduled_start_time",
        "is_active",
    )

    list_filter = (
        "is_active",
        "route",
    )

    inlines = [
        StopTimeInline,
    ]


@admin.register(StopTime)
class StopTimeAdmin(admin.ModelAdmin):
    list_display = (
        "id",
        "trip_schedule",
        "stop",
        "stop_sequence",
        "arrival_time",
    )

    list_filter = (
        "trip_schedule",
    )

    ordering = ("trip_schedule", "stop_sequence")
