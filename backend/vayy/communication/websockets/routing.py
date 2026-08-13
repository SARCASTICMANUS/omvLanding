from django.urls import path
from communication.websockets.consumers import NotificationConsumer

websocket_urlpatterns = [
    path('ws/notifications/<str:user_id>/', NotificationConsumer.as_asgi()),
]
