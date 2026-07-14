from django.urls import path
from tracking.websockets.consumers import (
    VehicleTrackingConsumer,
    TripTrackingConsumer,
    RouteTrackingConsumer,
    RoutePassengerTrackingConsumer,
    RideRequestConsumer,
)

websocket_urlpatterns = [
    path('ws/tracking/vehicle/<uuid:vehicle_id>/', VehicleTrackingConsumer.as_asgi()),
    path('ws/tracking/trip/<uuid:trip_id>/', TripTrackingConsumer.as_asgi()),
    path('ws/tracking/route/<uuid:route_id>/', RouteTrackingConsumer.as_asgi()),
    path('ws/tracking/route-passengers/<uuid:route_id>/', RoutePassengerTrackingConsumer.as_asgi()),
    path('ws/tracking/ride-requests/', RideRequestConsumer.as_asgi()),
]
