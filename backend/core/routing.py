from django.urls import re_path
from . import consumers

websocket_urlpatterns = [
    # Matches: ws://localhost:8000/ws/trip/<UUID>/<role>/
    re_path(
        r"ws/trip/(?P<trip_id>[\w-]+)/(?P<role>\w+)/$", consumers.VayyConsumer.as_asgi()
    ),
]
