from django.urls import path
from operations.websockets.consumers import DispatchStatusConsumer, DispatchBroadcastConsumer

websocket_urlpatterns = [
    path('ws/dispatch/<uuid:dispatch_id>/', DispatchStatusConsumer.as_asgi()),
    path('ws/dispatch/broadcast/<uuid:request_id>/', DispatchBroadcastConsumer.as_asgi()),
]
