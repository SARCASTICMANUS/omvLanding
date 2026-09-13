from django.contrib import admin
from kpi.models import PageView, KPISnapshot


@admin.register(PageView)
class PageViewAdmin(admin.ModelAdmin):
    list_display = ["platform", "page", "visitor_id", "ip_address", "country", "created_at"]
    list_filter = ["platform", "created_at"]
    search_fields = ["page", "visitor_id", "ip_address"]
    readonly_fields = ["id", "created_at"]


@admin.register(KPISnapshot)
class KPISnapshotAdmin(admin.ModelAdmin):
    list_display = ["date", "total_users", "total_routes", "web_visits", "app_visits"]
    list_filter = ["date"]
    readonly_fields = ["id", "created_at"]
