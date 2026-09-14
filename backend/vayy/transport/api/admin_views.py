import logging
from django.contrib.gis.geos import LineString, Point
from math import radians, sin, cos, sqrt, atan2
from rest_framework import viewsets, status
from rest_framework.response import Response
from rest_framework.views import APIView

from accounts.permissions import IsAdmin
from transport.api.serializers import (
    RouteListSerializer,
    RouteDetailSerializer,
    StopSerializer,
)
from transport.models import Route, Stop
from transport.services.osrm_service import OSRMService

logger = logging.getLogger(__name__)


class AdminRouteViewSet(viewsets.ModelViewSet):
    queryset = Route.objects.all().select_related("city").prefetch_related(
        "stops", "schedules", "schedules__stop_times", "schedules__stop_times__stop"
    )
    permission_classes = [IsAdmin]

    def get_serializer_class(self):
        if self.action == "list":
            return RouteListSerializer
        return RouteDetailSerializer

    def list(self, request, *args, **kwargs):
        resp = super().list(request, *args, **kwargs)
        return Response({"success": True, "data": resp.data})

    def create(self, request, *args, **kwargs):
        resp = super().create(request, *args, **kwargs)
        return Response({"success": True, "data": resp.data}, status=status.HTTP_201_CREATED)

    def retrieve(self, request, *args, **kwargs):
        resp = super().retrieve(request, *args, **kwargs)
        return Response({"success": True, "data": resp.data})

    def update(self, request, *args, **kwargs):
        resp = super().update(request, *args, **kwargs)
        return Response({"success": True, "data": resp.data})

    def destroy(self, request, *args, **kwargs):
        super().destroy(request, *args, **kwargs)
        return Response({"success": True, "message": "Route deleted"}, status=status.HTTP_200_OK)


class AdminStopViewSet(viewsets.ModelViewSet):
    queryset = Stop.objects.all().select_related("route")
    serializer_class = StopSerializer
    permission_classes = [IsAdmin]

    def list(self, request, *args, **kwargs):
        resp = super().list(request, *args, **kwargs)
        return Response({"success": True, "data": resp.data})

    def create(self, request, *args, **kwargs):
        resp = super().create(request, *args, **kwargs)
        return Response({"success": True, "data": resp.data}, status=status.HTTP_201_CREATED)

    def retrieve(self, request, *args, **kwargs):
        resp = super().retrieve(request, *args, **kwargs)
        return Response({"success": True, "data": resp.data})

    def update(self, request, *args, **kwargs):
        resp = super().update(request, *args, **kwargs)
        return Response({"success": True, "data": resp.data})

    def destroy(self, request, *args, **kwargs):
        super().destroy(request, *args, **kwargs)
        return Response({"success": True, "message": "Stop deleted"}, status=status.HTTP_200_OK)


class AdminRouteImportAPIView(APIView):
    permission_classes = [IsAdmin]

    def post(self, request):
        city_id = request.data.get("city")
        route_name = request.data.get("route_name", "Imported Route")
        route_code = request.data.get("route_code", "")
        stops_input = request.data.get("stops", [])

        if not city_id:
            return Response(
                {"success": False, "message": "City is required"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if not stops_input or len(stops_input) < 2:
            return Response(
                {"success": False, "message": "Need at least 2 stops to create a route"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        stops_data = []
        for i, s in enumerate(stops_input):
            try:
                lat = float(s.get("lat", 0))
                lon = float(s.get("lon", 0))
            except (ValueError, TypeError):
                continue
            if not (-90 <= lat <= 90) or not (-180 <= lon <= 180):
                continue
            stops_data.append({
                "lat": lat,
                "lon": lon,
                "name": s.get("name", f"Stop {i + 1}"),
                "order": int(s.get("order", i)),
            })

        if len(stops_data) < 2:
            return Response(
                {"success": False, "message": "Need at least 2 valid stops with lat/lon"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        stops_data.sort(key=lambda s: s["order"])

        osrm_coords = [(s["lon"], s["lat"]) for s in stops_data]
        all_waypoints = list(range(len(osrm_coords)))

        logger.info(f"IMPORT: Routing {len(osrm_coords)} stops via OSRM: {osrm_coords[:3]}...")

        osrm_result = OSRMService.route(
            *osrm_coords,
            geometries="geojson",
            overview="full",
            waypoints=all_waypoints,
        )

        road_coords = []
        total_distance = 0

        if osrm_result and osrm_result.get("routes"):
            route_geom = osrm_result["routes"][0]
            geometry = route_geom.get("geometry", {})
            coords = geometry.get("coordinates", [])
            if geometry.get("type") == "LineString" and len(coords) >= 2:
                road_coords = [tuple(c) for c in coords]
                total_distance = route_geom.get("distance", 0)
                logger.info(f"IMPORT: OSRM returned {len(road_coords)} geometry points, distance={total_distance}m")
            else:
                logger.warning(f"IMPORT: OSRM geometry invalid: type={geometry.get('type')}, coords={len(coords)}")
        else:
            err = osrm_result.get("code") if osrm_result else "no response"
            logger.warning(f"IMPORT: OSRM failed: {err}, result={osrm_result}")

        if not road_coords:
            logger.info("IMPORT: Falling back to straight-line geometry")
            road_coords = osrm_coords
            for i in range(len(road_coords) - 1):
                lon1, lat1 = road_coords[i]
                lon2, lat2 = road_coords[i + 1]
                R = 6371000
                dlat = radians(lat2 - lat1)
                dlon = radians(lon2 - lon1)
                a = sin(dlat / 2) ** 2 + cos(radians(lat1)) * cos(radians(lat2)) * sin(dlon / 2) ** 2
                total_distance += R * 2 * atan2(sqrt(a), sqrt(1 - a))

        path = LineString(road_coords, srid=4326)

        route = Route.objects.create(
            city_id=city_id,
            name=route_name,
            route_code=route_code,
            path=path,
            start_name=stops_data[0]["name"],
            end_name=stops_data[-1]["name"],
            total_distance_meters=round(total_distance, 2),
        )

        stop_objs = [
            Stop(
                route=route,
                name=s["name"],
                location=Point(s["lon"], s["lat"], srid=4326),
                order=s["order"],
            )
            for s in stops_data
        ]
        Stop.objects.bulk_create(stop_objs)

        return Response({
            "success": True,
            "data": {
                "route": RouteDetailSerializer(route).data,
                "stops_created": len(stop_objs),
                "road_snapped": len(road_coords) > len(osrm_coords),
                "geometry_points": len(road_coords),
                "message": f"Route imported with {len(stop_objs)} stops and {len(road_coords)} road-snapped geometry points",
            },
        }, status=status.HTTP_201_CREATED)
