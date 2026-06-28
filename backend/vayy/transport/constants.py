from django.db import models

TRANSPORT_MODE_BUS = "bus"

ROUTE_PUBLIC = "public"
ROUTE_PRIVATE = "private"

ROUTE_VISIBILITY_CHOICES = (
    (ROUTE_PUBLIC, "Public"),
    (ROUTE_PRIVATE, "Private"),
)