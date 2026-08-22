from django.urls import path, include
from rest_framework.routers import DefaultRouter

from transport.api.admin_views import AdminRouteViewSet, AdminStopViewSet

router = DefaultRouter()
router.register(r"routes", AdminRouteViewSet, basename="admin-route")
router.register(r"stops", AdminStopViewSet, basename="admin-stop")

urlpatterns = [
    path("", include(router.urls)),
]
