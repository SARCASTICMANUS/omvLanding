from django.urls import path
from tracking.websockets.admin_monitor import AdminMonitorConsumer
from tracking.websockets.consumers import (
    VehicleTrackingConsumer,
    TripTrackingConsumer,
    RouteTrackingConsumer,
    RoutePassengerTrackingConsumer,
    RideRequestConsumer,
    StopTrackingConsumer,
)

websocket_urlpatterns = [
    path('ws/tracking/vehicle/<uuid:vehicle_id>/', VehicleTrackingConsumer.as_asgi()),
    path('ws/tracking/trip/<uuid:trip_id>/', TripTrackingConsumer.as_asgi()),
    path('ws/tracking/route/<uuid:route_id>/', RouteTrackingConsumer.as_asgi()),
    path('ws/tracking/route-passengers/<uuid:route_id>/', RoutePassengerTrackingConsumer.as_asgi()),
    path('ws/tracking/ride-requests/', RideRequestConsumer.as_asgi()),
    # Passenger watching one stop: the journey equivalent of the route feed.
    # Opens to any authenticated user because a stop is a public boarding point,
    # same reasoning as user_may_view_route.
    path('ws/tracking/stop/<uuid:stop_id>/', StopTrackingConsumer.as_asgi()),
    # Operations console: one socket carrying the whole fleet. Staff-gated in
    # the consumer, because this group has no per-object owner to scope to.
    path('ws/admin/monitor/', AdminMonitorConsumer.as_asgi()),
]
