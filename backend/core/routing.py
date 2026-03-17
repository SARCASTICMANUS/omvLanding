from django.urls import re_path
from . import consumers

websocket_urlpatterns = [
    # Matches: ws://localhost:8000/ws/tracking/<university_id>/<role>/[trip_id/]?
    re_path(
        r"ws/tracking/(?P<university_id>[\w-]+)/(?P<role>\w+)/(?:(?P<trip_id>[\w-]+)/)?$",
        consumers.VayyConsumer.as_asgi(),
    ),
    # Matches: ws://localhost:8000/ws/university/<university_id>/<role>/
    re_path(
        r"ws/university/(?P<university_id>[\w-]+)/(?P<role>\w+)/$",
        consumers.VayyConsumer.as_asgi(),
    ),
    # Legacy/Alternative: ws://localhost:8000/ws/trip/(?P<trip_id>[\w-]+)/(?P<role>\w+)/
    re_path(
        r"ws/trip/(?P<trip_id>[\w-]+)/(?P<role>\w+)/$",
        consumers.VayyConsumer.as_asgi(),
    ),
]
