from rest_framework import serializers
from kpi.models import PageView, KPISnapshot


class PageViewSerializer(serializers.ModelSerializer):
    client_ip = serializers.CharField(required=False, write_only=True, default="")

    class Meta:
        model = PageView
        fields = ["id", "platform", "page", "visitor_id", "ip_address", "user_agent", "referrer", "country", "city", "device_type", "client_ip", "created_at"]
        read_only_fields = ["id", "created_at"]


class KPISnapshotSerializer(serializers.ModelSerializer):
    class Meta:
        model = KPISnapshot
        fields = "__all__"
