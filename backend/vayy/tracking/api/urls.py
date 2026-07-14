from django.urls import path
from tracking.api.views import (
    GPSIngestAPIView,
    TelemetryIngestAPIView,
    VehicleTrackingAPIView,
    TripTrackingAPIView,
    NearbyVehiclesAPIView,
    PassengerLocationAPIView,
    DriverLocationAPIView,
    StartRouteTripView,
    EndRouteTripView,
    PassengerRaiseHandView,
    RideLifecycleView,
    RouteStopsView,
    ActiveRouteTripsView,
    NearbyRoutesView,
)

urlpatterns = [
    # ── Existing endpoints ───────────────────────────────────
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
    path(
        "driver-location/",
        DriverLocationAPIView.as_view(),
        name="driver-location",
    ),
    # ── Route-based trip management ──────────────────────────
    path(
        "start-route-trip/",
        StartRouteTripView.as_view(),
        name="start-route-trip",
    ),
    path(
        "end-route-trip/",
        EndRouteTripView.as_view(),
        name="end-route-trip",
    ),
    # ── Passenger ride request ───────────────────────────────
    path(
        "raise-hand/",
        PassengerRaiseHandView.as_view(),
        name="passenger-raise-hand",
    ),
    # ── Ride lifecycle ───────────────────────────────────────
    path(
        "ride-lifecycle/",
        RideLifecycleView.as_view(),
        name="ride-lifecycle",
    ),
    # ── Route info ───────────────────────────────────────────
    path(
        "route/<uuid:route_id>/stops/",
        RouteStopsView.as_view(),
        name="route-stops",
    ),
    path(
        "route/<uuid:route_id>/active-trips/",
        ActiveRouteTripsView.as_view(),
        name="active-route-trips",
    ),
    path(
        "nearby-routes/",
        NearbyRoutesView.as_view(),
        name="nearby-routes",
    ),
]
