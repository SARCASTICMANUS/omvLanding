from django.urls import path

from kpi.api.views import (
    AdminStatsAPI,
    GeoStatsAPI,
    KPIOverviewAPI,
    KPISnapshotAPI,
    TrackPageViewAPI,
)

urlpatterns = [
    path("track/", TrackPageViewAPI.as_view(), name="kpi-track"),
    path("overview/", KPIOverviewAPI.as_view(), name="kpi-overview"),
    path("snapshots/", KPISnapshotAPI.as_view(), name="kpi-snapshots"),
    path("admin-stats/", AdminStatsAPI.as_view(), name="kpi-admin-stats"),
    path("geo-stats/", GeoStatsAPI.as_view(), name="kpi-geo-stats"),
]
