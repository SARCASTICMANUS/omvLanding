from django.contrib import admin
from django.urls import path
from core.api.views import (
    GlobalSearchView,
    DriverStartTripView,
    PassengerMatchView,
    AdminRouteView,
)
from django.conf import settings
from django.conf.urls.static import static


urlpatterns = [
    path("admin/", admin.site.urls),
    # API Endpoints
    path("api/global-search/", GlobalSearchView.as_view()),
    path("api/driver/start-trip/", DriverStartTripView.as_view()),
    path("api/passenger/match/", PassengerMatchView.as_view()),
    path("api/admin/routes/", AdminRouteView.as_view()),  # New Admin CRUD
    path("api/driver/routes/", DriverStartTripView.as_view()),  # For driver dropdown
    path("api/driver/start-trip/", DriverStartTripView.as_view()),
    # path("api/passenger/match/", PassengerMatchView.as_view()),
    path("api/global-search/", GlobalSearchView.as_view()),
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
