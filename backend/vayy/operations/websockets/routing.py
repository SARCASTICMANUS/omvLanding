from django.urls import path
from operations.websockets.consumers import DispatchStatusConsumer

websocket_urlpatterns = [
    path('ws/dispatch/<uuid:dispatch_id>/', DispatchStatusConsumer.as_asgi()),
]
