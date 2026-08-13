from django.contrib import admin

from tracking.models import HybridLog


@admin.register(HybridLog)
class HybridLogAdmin(admin.ModelAdmin):
    list_display = (
        "id",
        "user",
        "vehicle",
        "trip",
        "speed",
        "heading",
        "device_id",
        "timestamp",
        "created_at",
    )

    list_filter = (
        "vehicle",
        "timestamp",
    )

    search_fields = (
        "user__email",
        "vehicle__vehicle_number",
        "device_id",
    )

    readonly_fields = (
        "created_at",
    )

    raw_id_fields = (
        "user",
        "vehicle",
        "trip",
    )

    fields = (
        "user",
        "vehicle",
        "trip",
        "location",
        "speed",
        "heading",
        "cell_towers",
        "wifi_aps",
        "device_id",
        "timestamp",
        "created_at",
    )

    ordering = ("-timestamp",)
