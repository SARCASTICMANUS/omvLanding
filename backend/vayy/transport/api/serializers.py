from rest_framework import serializers
from django.contrib.gis.geos import LineString, Point

from transport.models import (
    City,
    Route,
    Stop,
    TripSchedule,
    StopTime,
)


class CitySerializer(serializers.ModelSerializer):
    class Meta:
        model = City
        fields = (
            "id",
            "name",
            "state",
            "country",
            "location",
        )


class StopSerializer(serializers.ModelSerializer):
    short_name = serializers.SerializerMethodField()

    class Meta:
        model = Stop
        fields = (
            "id",
            "route",
            "name",
            "location",
            "order",
            "short_name",
            "plus_code",
            "nearby_landmark",
        )

    def get_short_name(self, obj):
        return obj.name.split(",")[0] if obj.name else obj.name

    def to_representation(self, instance):
        data = super().to_representation(instance)
        loc = instance.location
        if loc and isinstance(loc, Point):
            data["location"] = {
                "type": "Point",
                "coordinates": [loc.x, loc.y],
            }
        return data

    def create(self, validated_data):
        loc_data = validated_data.pop('location', None)
        if loc_data:
            validated_data['location'] = Point(*loc_data['coordinates'], srid=4326)
        return super().create(validated_data)

    def update(self, instance, validated_data):
        loc_data = validated_data.pop('location', None)
        if loc_data:
            validated_data['location'] = Point(*loc_data['coordinates'], srid=4326)
        return super().update(instance, validated_data)


class NearbyStopSerializer(serializers.ModelSerializer):
    route = serializers.UUIDField(
        source="route_id",
        read_only=True,
    )
    route_name = serializers.CharField(
        source="route.name",
        read_only=True,
    )
    distance_meters = serializers.FloatField(
        read_only=True,
    )

    class Meta:
        model = Stop
        fields = (
            "id",
            "route",
            "route_name",
            "name",
            "location",
            "order",
            "distance_meters",
        )


class StopTimeSerializer(serializers.ModelSerializer):
    class Meta:
        model = StopTime
        fields = (
            "id",
            "trip_schedule",
            "stop",
            "arrival_time",
            "stop_sequence",
        )

    def to_representation(self, instance):
        representation = super().to_representation(instance)
        representation['stop'] = StopSerializer(instance.stop).data
        return representation


class TripScheduleSerializer(
    serializers.ModelSerializer
):
    stop_times = StopTimeSerializer(
        many=True,
        read_only=True,
    )

    class Meta:
        model = TripSchedule
        fields = (
            "id",
            "route",
            "label",
            "scheduled_start_time",
            "is_active",
            "stop_times",
        )


class RouteListSerializer(
    serializers.ModelSerializer
):
    city_name = serializers.CharField(
        source="city.name",
        read_only=True,
    )
    stops_count = serializers.SerializerMethodField()
    path = serializers.SerializerMethodField()

    class Meta:
        model = Route

        fields = (
            "id",
            "city",
            "name",
            "route_code",
            "city_name",
            "path",
            "start_name",
            "end_name",
            "total_distance_meters",
            "is_public",
            "stops_count",
        )

    def get_stops_count(self, obj):
        return obj.stops.count() if hasattr(obj, 'stops') else 0

    def get_path(self, instance):
        if instance.path is None:
            return None
        import json
        return json.loads(instance.path.geojson)


class RouteDetailSerializer(
    serializers.ModelSerializer
):
    stops = StopSerializer(
        many=True,
        read_only=True,
    )

    schedules = TripScheduleSerializer(
        many=True,
        read_only=True,
    )

    path = serializers.SerializerMethodField()

    class Meta:
        model = Route

        fields = (
            "id",
            "city",
            "name",
            "route_code",
            "path",
            "start_name",
            "end_name",
            "total_distance_meters",
            "is_public",
            "stops",
            "schedules",
            "created_at",
            "updated_at",
        )

    def get_path(self, instance):
        if instance.path is None:
            return None
        import json
        return json.loads(instance.path.geojson)

    def to_representation(self, instance):
        representation = super().to_representation(instance)
        representation['city'] = CitySerializer(instance.city).data
        return representation

    def create(self, validated_data):
        path_data = validated_data.pop('path', None)
        if path_data:
            validated_data['path'] = LineString(path_data['coordinates'], srid=4326)
        return super().create(validated_data)

    def update(self, instance, validated_data):
        path_data = validated_data.pop('path', None)
        if path_data:
            validated_data['path'] = LineString(path_data['coordinates'], srid=4326)
        return super().update(instance, validated_data)


class DriverRouteStopSerializer(serializers.ModelSerializer):
    lat = serializers.SerializerMethodField()
    lon = serializers.SerializerMethodField()
    is_boarding_point = serializers.SerializerMethodField()
    arrival_time = serializers.SerializerMethodField()

    class Meta:
        model = Stop
        fields = ("id", "name", "order", "lat", "lon", "is_boarding_point", "arrival_time")

    def get_lat(self, obj):
        return obj.location.y if obj.location else None

    def get_lon(self, obj):
        return obj.location.x if obj.location else None

    def get_is_boarding_point(self, obj):
        return obj.order == 0

    def get_arrival_time(self, obj):
        try:
            st = obj.stoptime_set.first()
            if st and st.arrival_time:
                return st.arrival_time.strftime("%I:%M %p").lstrip("0")
        except Exception:
            pass
        return None


class DriverRouteSerializer(serializers.ModelSerializer):
    route_id = serializers.UUIDField(source="id", read_only=True)
    route_name = serializers.CharField(source="name", read_only=True)
    code = serializers.SerializerMethodField()
    source_name = serializers.CharField(source="start_name", read_only=True)
    destination_name = serializers.CharField(source="end_name", read_only=True)
    total_distance = serializers.FloatField(source="total_distance_meters", read_only=True)
    distance_meters = serializers.FloatField(source="total_distance_meters", read_only=True)
    duration_minutes = serializers.SerializerMethodField()
    eta_minutes = serializers.SerializerMethodField()
    stops = DriverRouteStopSerializer(many=True, read_only=True)

    class Meta:
        model = Route
        fields = (
            "id", "route_id", "name", "route_name", "code", "route_code",
            "source_name", "destination_name", "start_name", "end_name",
            "total_distance", "total_distance_meters", "distance_meters",
            "duration_minutes", "eta_minutes", "stops",
        )

    def get_code(self, obj):
        return obj.route_code or f"VAYY-{str(obj.id)[:8].upper()}"

    def get_duration_minutes(self, obj):
        if obj.total_distance_meters and obj.total_distance_meters > 0:
            stops = list(obj.stops.all().order_by("order"))
            if len(stops) >= 2:
                from transport.services.osrm_service import OSRMService
                duration_s = OSRMService.get_cached_road_duration_s(
                    (stops[0].location.x, stops[0].location.y),
                    (stops[-1].location.x, stops[-1].location.y),
                )
                if duration_s is None:
                    duration_s = OSRMService.get_road_duration_s(
                        (stops[0].location.x, stops[0].location.y),
                        (stops[-1].location.x, stops[-1].location.y),
                    )
                if duration_s is not None and duration_s > 0:
                    return max(1, round(duration_s / 60))
            return max(1, round(obj.total_distance_meters / 1000 / 25 * 60))
        return 18

    def get_eta_minutes(self, obj):
        return self.get_duration_minutes(obj)


class RouteSearchInputSerializer(serializers.Serializer):
    origin_lat = serializers.FloatField(min_value=-90, max_value=90)
    origin_lng = serializers.FloatField(min_value=-180, max_value=180)
    dest_lat = serializers.FloatField(min_value=-90, max_value=90)
    dest_lng = serializers.FloatField(min_value=-180, max_value=180)
    radius = serializers.IntegerField(required=False, default=5000, min_value=100, max_value=10000)
    role = serializers.ChoiceField(
        choices=("passenger", "driver"),
        required=False,
        default="passenger",
        help_text="Requesting role. Defaults to the full passenger payload; 'driver' returns a trimmed payload.",
    )


class StopOutputSerializer(serializers.Serializer):
    id = serializers.CharField()
    name = serializers.CharField()
    order = serializers.IntegerField()
    lat = serializers.SerializerMethodField()
    lon = serializers.SerializerMethodField()
    location = serializers.SerializerMethodField()
    cumulative_distance_meters = serializers.SerializerMethodField()
    cumulative_duration_s = serializers.SerializerMethodField()

    def _extract_coords(self, obj):
        loc = obj["location"] if isinstance(obj, dict) else getattr(obj, "location", None)
        if loc is None:
            return 0.0, 0.0
        if isinstance(loc, dict):
            coords = loc.get("coordinates", [0.0, 0.0])
            return coords[0], coords[1]
        return loc.x, loc.y

    def get_lat(self, obj):
        _, lat = self._extract_coords(obj)
        return lat

    def get_lon(self, obj):
        lon, _ = self._extract_coords(obj)
        return lon

    def get_location(self, obj):
        lon, lat = self._extract_coords(obj)
        return {"type": "Point", "coordinates": [lon, lat]}

    @staticmethod
    def _cumulative_value(obj, key):
        value = obj.get(key) if isinstance(obj, dict) else getattr(obj, key, None)
        return round(value) if value is not None else None

    def get_cumulative_distance_meters(self, obj):
        return self._cumulative_value(obj, "cumulative_distance_m")

    def get_cumulative_duration_s(self, obj):
        return self._cumulative_value(obj, "cumulative_duration_s")


class NearestRoadSerializer(serializers.Serializer):
    name = serializers.CharField(required=False, allow_null=True)
    location = serializers.JSONField(required=False, allow_null=True)
    distance_meters = serializers.IntegerField(required=False, allow_null=True)
    is_nearest = serializers.BooleanField(required=False, allow_null=True)


class PickupDropoffStopSerializer(serializers.Serializer):
    id = serializers.CharField()
    name = serializers.CharField()
    order = serializers.IntegerField()
    lat = serializers.FloatField()
    lon = serializers.FloatField()
    location = serializers.DictField()
    distance_meters = serializers.IntegerField(required=False, allow_null=True)
    distance_to_destination_meters = serializers.IntegerField(required=False, allow_null=True)
    is_nearest = serializers.BooleanField(required=False, default=False)


class RouteSearchResponseSerializer(serializers.Serializer):
    id = serializers.CharField()
    name = serializers.CharField()
    route_code = serializers.CharField()
    city_name = serializers.CharField()
    start_name = serializers.CharField()
    end_name = serializers.CharField()
    total_distance_meters = serializers.IntegerField()
    fare = serializers.IntegerField()
    eta_seconds = serializers.IntegerField()
    walk_minutes = serializers.IntegerField()
    walk_distance_meters = serializers.IntegerField()
    distance_km = serializers.FloatField()
    pickup_stop = PickupDropoffStopSerializer()
    dropoff_stop = PickupDropoffStopSerializer()
    stops = StopOutputSerializer(many=True)
    first_mile_walk_meters = serializers.IntegerField()
    last_mile_walk_meters = serializers.IntegerField()
    nearest_road = NearestRoadSerializer(allow_null=True, required=False)
    nearest_road_distance = serializers.IntegerField()
    nearest_road_stop_distance = serializers.IntegerField()

class DriverRouteSearchResponseSerializer(serializers.Serializer):
    """
    Driver-facing payload for /routes/search-by-location/?role=driver.
    Trims passenger-only walk aggregates and nearest-road metadata while
    keeping first/last-mile walk (drivers ride to the boarding point) and
    the full stops array with cumulative metrics.
    """
    id = serializers.CharField()
    name = serializers.CharField()
    route_code = serializers.CharField()
    city_name = serializers.CharField()
    start_name = serializers.CharField()
    end_name = serializers.CharField()
    total_distance_meters = serializers.IntegerField()
    fare = serializers.IntegerField()
    eta_seconds = serializers.IntegerField()
    distance_km = serializers.FloatField()
    first_mile_walk_meters = serializers.IntegerField()
    last_mile_walk_meters = serializers.IntegerField()
    pickup_stop = PickupDropoffStopSerializer()
    dropoff_stop = PickupDropoffStopSerializer()
    stops = StopOutputSerializer(many=True)