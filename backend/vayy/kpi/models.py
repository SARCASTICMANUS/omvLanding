import uuid
from django.db import models


class PageView(models.Model):
    PLATFORM_CHOICES = [
        ("web", "Website"),
        ("app", "Mobile App"),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    platform = models.CharField(max_length=10, choices=PLATFORM_CHOICES, db_index=True)
    page = models.CharField(max_length=255, db_index=True)
    visitor_id = models.CharField(max_length=255, blank=True, default="")
    ip_address = models.GenericIPAddressField(null=True, blank=True)
    user_agent = models.TextField(blank=True, default="")
    referrer = models.URLField(blank=True, default="")
    utm_source = models.CharField(max_length=100, blank=True, default="")
    utm_medium = models.CharField(max_length=100, blank=True, default="")
    utm_campaign = models.CharField(max_length=255, blank=True, default="")
    utm_term = models.CharField(max_length=255, blank=True, default="")
    utm_content = models.CharField(max_length=255, blank=True, default="")
    country = models.CharField(max_length=100, blank=True, default="")
    city = models.CharField(max_length=100, blank=True, default="")
    region = models.CharField(max_length=255, blank=True, default="")
    country_code = models.CharField(max_length=2, blank=True, default="")
    latitude = models.FloatField(null=True, blank=True)
    longitude = models.FloatField(null=True, blank=True)
    timezone = models.CharField(max_length=64, blank=True, default="")
    device_type = models.CharField(max_length=50, blank=True, default="")
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)

    class Meta:
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["platform", "created_at"]),
            models.Index(fields=["page", "created_at"]),
            models.Index(fields=["country_code"]),
            models.Index(fields=["region"]),
            models.Index(fields=["utm_source"]),
        ]

    def __str__(self):
        return f"{self.platform} - {self.page} at {self.created_at}"


class KPISnapshot(models.Model):
    """Daily snapshot of key metrics for fast dashboard queries."""
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    date = models.DateField(unique=True, db_index=True)
    total_users = models.IntegerField(default=0)
    total_passengers = models.IntegerField(default=0)
    total_drivers = models.IntegerField(default=0)
    total_routes = models.IntegerField(default=0)
    total_stops = models.IntegerField(default=0)
    total_trips = models.IntegerField(default=0)
    total_cities = models.IntegerField(default=0)
    web_visits = models.IntegerField(default=0)
    app_visits = models.IntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-date"]

    def __str__(self):
        return f"KPI {self.date}: {self.total_users} users, {self.web_visits + self.app_visits} visits"
