from rest_framework import serializers
from kpi.models import PageView, KPISnapshot


class PageViewSerializer(serializers.ModelSerializer):
    client_ip = serializers.CharField(required=False, write_only=True, default="")
    utm_source = serializers.CharField(required=False, allow_blank=True, default="")
    utm_medium = serializers.CharField(required=False, allow_blank=True, default="")
    utm_campaign = serializers.CharField(required=False, allow_blank=True, default="")
    utm_term = serializers.CharField(required=False, allow_blank=True, default="")
    utm_content = serializers.CharField(required=False, allow_blank=True, default="")

    class Meta:
        model = PageView
        fields = [
            "id", "platform", "page", "visitor_id", "ip_address", "user_agent",
            "referrer", "utm_source", "utm_medium", "utm_campaign", "utm_term",
            "utm_content", "country", "city", "device_type", "client_ip",
            "created_at",
        ]
        read_only_fields = ["id", "created_at"]


class KPISnapshotSerializer(serializers.ModelSerializer):
    class Meta:
        model = KPISnapshot
        fields = "__all__"
