"""
ASGI config for vayy project.

It exposes the ASGI callable as a module-level variable named ``application``.

For more information on this file, see
https://docs.djangoproject.com/en/6.0/howto/deployment/asgi/
"""

import os
from django.core.asgi import get_asgi_application
from channels.routing import ProtocolTypeRouter, URLRouter
from django.urls import path

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'vayy.settings')

# Initialize Django ASGI application early to ensure AppRegistry is ready
django_asgi_app = get_asgi_application()


from tracking.websockets.routing import websocket_urlpatterns as tracking_ws_urls
from operations.websockets.routing import websocket_urlpatterns as operations_ws_urls
from communication.websockets.routing import websocket_urlpatterns as communication_ws_urls

# Combined websocket routing
websocket_urlpatterns = (
    tracking_ws_urls +
    operations_ws_urls +
    communication_ws_urls
)

application = ProtocolTypeRouter({
    "http": django_asgi_app,
    "websocket": URLRouter(
        websocket_urlpatterns
    ),
})
