from django.urls import path, include
from rest_framework.routers import DefaultRouter

from transport.api.views import (
    CityViewSet,
    RouteViewSet,
    StopViewSet,
    TripScheduleViewSet,
    StopTimeViewSet,
    NearbyStopListAPIView,
    RouteByRouteCodeAPIView,
    RouteScheduleAPIView,
    StopETAAPIView,
    RouteGeometryAPIView,
    RoutePreviewAPIView,
    RouteSearchByLocationAPIView,
    DriverRouteListAPIView,
    PassengersAlongRouteAPIView,
    RoadDistanceAPIView,
    GeocodeSearchAPIView,
    GeocodeReverseAPIView,
)

router = DefaultRouter()
router.register(r"cities", CityViewSet, basename="city")
router.register(r"routes", RouteViewSet, basename="route")
router.register(r"stops", StopViewSet, basename="stop")
router.register(r"schedules", TripScheduleViewSet, basename="schedule")
router.register(r"stop-times", StopTimeViewSet, basename="stop-time")

urlpatterns = [
    path(
        "geocode/search/",
        GeocodeSearchAPIView.as_view(),
        name="geocode-search",
    ),
    path(
        "geocode/reverse/",
        GeocodeReverseAPIView.as_view(),
        name="geocode-reverse",
    ),
    path(
        "driver/routes/",
        DriverRouteListAPIView.as_view(),
        name="driver-route-list",
    ),
    path(
        "routes/search-by-location/",
        RouteSearchByLocationAPIView.as_view(),
        name="route-search-by-location",
    ),
    path(
        "routes/preview/",
        RoutePreviewAPIView.as_view(),
        name="route-preview",
    ),
    path(
        "routes/<uuid:route_id>/nearby-passengers/",
        PassengersAlongRouteAPIView.as_view(),
        name="route-nearby-passengers",
    ),
    path(
        "routes/<uuid:route_id>/geometry/",
        RouteGeometryAPIView.as_view(),
        name="route-geometry",
    ),
    path(
        "routes/<uuid:route_id>/schedule/",
        RouteScheduleAPIView.as_view(),
        name="route-schedule",
    ),
    path(
        "routes/code/<str:route_code>/",
        RouteByRouteCodeAPIView.as_view(),
        name="route-by-route-code",
    ),
    path("", include(router.urls)),
    path(
        "stops/nearby/",
        NearbyStopListAPIView.as_view(),
        name="nearby-stop-list",
    ),
    path(
        "stops/<uuid:stop_id>/eta/",
        StopETAAPIView.as_view(),
        name="stop-eta",
    ),
    path(
        "road-distance/",
        RoadDistanceAPIView.as_view(),
        name="road-distance",
    ),
]
