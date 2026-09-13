from django.urls import path
from kpi.api.views import TrackPageViewAPI, KPIOverviewAPI, KPISnapshotAPI

urlpatterns = [
    path("track/", TrackPageViewAPI.as_view(), name="kpi-track"),
    path("overview/", KPIOverviewAPI.as_view(), name="kpi-overview"),
    path("snapshots/", KPISnapshotAPI.as_view(), name="kpi-snapshots"),
]
