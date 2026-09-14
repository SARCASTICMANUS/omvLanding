from django.urls import path, include
from rest_framework.routers import DefaultRouter

from transport.api.admin_views import (
    AdminRouteViewSet,
    AdminStopViewSet,
    AdminRouteImportAPIView,
)

router = DefaultRouter()
router.register(r"routes", AdminRouteViewSet, basename="admin-route")
router.register(r"stops", AdminStopViewSet, basename="admin-stop")

urlpatterns = [
    path("route-import/", AdminRouteImportAPIView.as_view(), name="admin-route-import"),
    path("", include(router.urls)),
]
