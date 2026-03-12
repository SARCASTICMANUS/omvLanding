from django.conf import settings
from django.conf.urls.static import static
from django.contrib import admin
from django.urls import path, include
from rest_framework.routers import DefaultRouter
from core.api.views import (
    UniversityViewSet,
    VehicleViewSet,
    StudentAssignmentViewSet,
    GlobalSearchView,
    AdminRouteView,
    AdminRoutePreviewView,
    DriverStartTripView,
    PassengerMatchView,
    NearbyStopsView,
    AuthView,
)
from rest_framework_simplejwt.views import TokenRefreshView

router = DefaultRouter()
router.register(r"universities", UniversityViewSet)
router.register(r"vehicles", VehicleViewSet)
router.register(r"assignments", StudentAssignmentViewSet)

urlpatterns = [
    path("admin/", admin.site.urls),
    path("api/", include(router.urls)),
    # --- Auth Endpoints ---
    path("api/auth/register/", AuthView.as_view(), {"action": "register"}),
    path("api/auth/send-otp/", AuthView.as_view(), {"action": "send-otp"}),
    path("api/auth/verify-otp/", AuthView.as_view(), {"action": "verify-otp"}),
    path(
        "api/auth/login/",
        (
            AuthView.as_token_view()
            if hasattr(AuthView, "as_token_view")
            else AuthView.as_view()
        ),
        {"action": "login"},
    ),
    # Fix for login action
    # path("api/auth/login/", AuthView.as_view(), {"action": "login"}),
    path("api/auth/refresh/", TokenRefreshView.as_view()),
    # --- Feature Endpoints ---
    path("api/global-search/", GlobalSearchView.as_view()),
    # Admin
    path("api/admin/routes/", AdminRouteView.as_view()),
    path("api/admin/routes/preview/", AdminRoutePreviewView.as_view()),
    # Driver
    path("api/driver/routes/", DriverStartTripView.as_view()),
    path("api/driver/start-trip/", DriverStartTripView.as_view()),
    # Passenger
    path("api/passenger/match/", PassengerMatchView.as_view()),
    path("api/passenger/nearby-stops/", NearbyStopsView.as_view()),
]

if settings.DEBUG:
    urlpatterns += static(settings.STATIC_URL, document_root=settings.STATIC_ROOT)
# urlpatterns = [
#     path("admin/", admin.site.urls),
#     # API Endpoints
#     path("api/global-search/", GlobalSearchView.as_view()),
#     path("api/driver/start-trip/", DriverStartTripView.as_view()),
#     path("api/passenger/match/", PassengerMatchView.as_view()),
# ]
