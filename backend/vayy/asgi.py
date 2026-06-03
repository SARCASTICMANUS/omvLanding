import os
import django
from channels.routing import ProtocolTypeRouter, URLRouter
from channels.security.websocket import AllowedHostsOriginValidator
from django.core.asgi import get_asgi_application

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "vayy.settings")
django_asgi_app = get_asgi_application()

# Import routing AFTER setup
from core.routing import websocket_urlpatterns
from core.middleware import JWTAuthMiddleware, QueryAuthMiddleware

application = ProtocolTypeRouter(
    {
        "http": django_asgi_app,
        "websocket": QueryAuthMiddleware(URLRouter(websocket_urlpatterns)),
    }
)
