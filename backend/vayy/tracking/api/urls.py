from django.urls import path
from tracking.api.views import (
    GPSIngestAPIView,
    TelemetryIngestAPIView,
    VehicleTrackingAPIView,
    TripTrackingAPIView,
    NearbyVehiclesAPIView,
    PassengerLocationAPIView,
)

urlpatterns = [
    path(
        "gps/",
        GPSIngestAPIView.as_view(),
        name="gps-ingest",
    ),
    path(
        "nearby/",
        NearbyVehiclesAPIView.as_view(),
        name="nearby-vehicles",
    ),
    path(
        "ingest/",
        TelemetryIngestAPIView.as_view(),
        name="telemetry-ingest",
    ),
    path(
        "vehicle/<uuid:vehicle_id>/",
        VehicleTrackingAPIView.as_view(),
        name="vehicle-tracking",
    ),
    path(
        "trip/<uuid:trip_id>/",
        TripTrackingAPIView.as_view(),
        name="trip-tracking",
    ),
    path(
        "passenger-location/",
        PassengerLocationAPIView.as_view(),
        name="passenger-location",
    ),
]
