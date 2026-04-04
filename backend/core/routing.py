from django.urls import re_path
from . import consumers

websocket_urlpatterns = [
    # Public transport: ws://host/ws/public/<city_id>/<role>/[trip_id/]?
    re_path(
        r"ws/public/(?P<city_id>[\w-]+)/(?P<role>\w+)/(?:(?P<trip_id>[\w-]+)/)?$",
        consumers.VayyConsumer.as_asgi(),
    ),
    # Legacy/backward compat (kept for any existing connections)
    re_path(
        r"ws/tracking/(?P<city_id>[\w-]+)/(?P<role>\w+)/(?:(?P<trip_id>[\w-]+)/)?$",
        consumers.VayyConsumer.as_asgi(),
    ),
    re_path(
        r"ws/trip/(?P<trip_id>[\w-]+)/(?P<role>\w+)/$",
        consumers.VayyConsumer.as_asgi(),
    ),
]
