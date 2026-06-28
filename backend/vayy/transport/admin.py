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
        "name",
        "state",
        "country",
    )

    search_fields = (
        "name",
        "state",
    )


class StopInline(
    admin.TabularInline
):
    model = Stop
    extra = 0


class ScheduleInline(
    admin.TabularInline
):
    model = TripSchedule
    extra = 0


@admin.register(Route)
class RouteAdmin(admin.ModelAdmin):
    list_display = (
        "name",
        "city",
        "bus_number",
        "start_name",
        "end_name",
    )

    search_fields = (
        "name",
        "bus_number",
    )

    list_filter = (
        "city",
    )

    inlines = [
        StopInline,
        ScheduleInline,
    ]


@admin.register(Stop)
class StopAdmin(admin.ModelAdmin):
    list_display = (
        "name",
        "route",
        "order",
    )

    list_filter = (
        "route",
    )

    search_fields = (
        "name",
    )


class StopTimeInline(
    admin.TabularInline
):
    model = StopTime
    extra = 0


@admin.register(TripSchedule)
class TripScheduleAdmin(
    admin.ModelAdmin
):
    list_display = (
        "route",
        "label",
        "scheduled_start_time",
        "is_active",
    )

    list_filter = (
        "is_active",
    )

    inlines = [
        StopTimeInline,
    ]


@admin.register(StopTime)
class StopTimeAdmin(
    admin.ModelAdmin
):
    list_display = (
        "trip_schedule",
        "stop",
        "arrival_time",
        "stop_sequence",
    )

    list_filter = (
        "trip_schedule",
    )