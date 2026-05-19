# VAYY | vayy/urls.py | Status: ✅ Public Transport Refactor

from django.conf import settings
from django.conf.urls.static import static
from django.contrib import admin
from django.urls import path, include
from rest_framework.routers import DefaultRouter
from rest_framework_simplejwt.views import TokenRefreshView
from core.api.views import GoogleLogin

from core.api.views import (
    CityViewSet,
    VehicleViewSet,
    PassengerProfileViewSet,
    PublicDriverProfileViewSet,
    UserViewSet,
    BoardingRequestViewSet,
    GlobalSearchView,
    ReverseSearchView,
    AdminRouteView,
    AdminRoutePreviewView,
    BulkImportView,
    DriverStartTripView,
    DriverTripStatusView,
    TripEndView,
    TripNextStopsView,
    PassengerMatchView,
    PassengerNearbyStopsView,
    PassengerDashboardView,
    PassengerFilteredTripsView,
    PassengerRecentSearchesView,
    PassengerTripDetailView,
    TelemetryIngestView,
    AuthView,
    MeView,
)

router = DefaultRouter()
router.register(r"cities", CityViewSet)
router.register(r"vehicles", VehicleViewSet)
router.register(r"driver-profiles", PublicDriverProfileViewSet)
router.register(r"passenger-profiles", PassengerProfileViewSet)
router.register(r"users", UserViewSet)
router.register(r"boarding-requests", BoardingRequestViewSet)

urlpatterns = [
    path("admin/", admin.site.urls),
    path("api/", include(router.urls)),
    # ─── Social Auth ──────────────────────
    path("api/dj-rest-auth/", include("dj_rest_auth.urls")),
    path("api/dj-rest-auth/registration/", include("dj_rest_auth.registration.urls")),
    path("api/dj-rest-auth/google/", GoogleLogin.as_view(), name="google_login"),
    # ── Auth ──────────────────────────────────────────────────────────────────
    path("api/auth/register/", AuthView.as_view(), {"action": "register"}),
    path("api/auth/login/", AuthView.as_view(), {"action": "login"}),
    path("api/auth/send-otp/", AuthView.as_view(), {"action": "send-otp"}),
    path("api/auth/verify-otp/", AuthView.as_view(), {"action": "verify-otp"}),
    path("api/auth/set-password/", AuthView.as_view(), {"action": "set-password"}),
    path(
        "api/auth/forgot-password/", AuthView.as_view(), {"action": "forgot-password"}
    ),
    path("api/auth/reset-password/", AuthView.as_view(), {"action": "reset-password"}),
    path("api/auth/refresh/", TokenRefreshView.as_view()),
    path("api/auth/me/", MeView.as_view()),
    # ── Global Search ─────────────────────────────────────────────────────────
    path("api/global-search/", GlobalSearchView.as_view()),
    path("api/reverse-search/", ReverseSearchView.as_view()),
    # ── Admin: Routes ─────────────────────────────────────────────────────────
    path("api/admin/routes/", AdminRouteView.as_view()),
    path("api/admin/routes/preview/", AdminRoutePreviewView.as_view()),
    path("api/admin/routes/bulk-import/", BulkImportView.as_view()),
    path("api/routes/", AdminRouteView.as_view()),  # Alias for driver/passenger GET
    # ── Driver ────────────────────────────────────────────────────────────────
    path("api/driver/routes/", DriverStartTripView.as_view()),
    path("api/driver/start-trip/", DriverStartTripView.as_view()),
    path("api/driver/trip-status/<str:trip_id>/", DriverTripStatusView.as_view()),
    path("api/trips/start/", DriverStartTripView.as_view()),
    path("api/trips/end/<str:trip_id>/", TripEndView.as_view()),
    path("api/trips/next-stops/<str:trip_id>/", TripNextStopsView.as_view()),
    # ── Passenger ─────────────────────────────────────────────────────────────
    path("api/passenger/match/", PassengerMatchView.as_view()),
    path("api/passenger/nearby-stops/", PassengerNearbyStopsView.as_view()),
    path("api/passenger/dashboard/", PassengerDashboardView.as_view()),
    path("api/passenger/filtered-trips/", PassengerFilteredTripsView.as_view()),
    path("api/passenger/recent-searches/", PassengerRecentSearchesView.as_view()),
    path("api/passenger/trips/<str:trip_id>/", PassengerTripDetailView.as_view()),
    # ── Telemetry ─────────────────────────────────────────────────────────────
    path("api/telemetry/ingest/", TelemetryIngestView.as_view()),
    # Legacy aliases (keep existing frontend working during transition)
    path("api/student/dashboard/", PassengerDashboardView.as_view()),
]

if settings.DEBUG:
    urlpatterns += static(settings.STATIC_URL, document_root=settings.STATIC_ROOT)
