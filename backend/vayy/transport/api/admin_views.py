from rest_framework import viewsets, status
from rest_framework.response import Response

from accounts.permissions import IsAdmin
from transport.api.serializers import (
    RouteListSerializer,
    RouteDetailSerializer,
    StopSerializer,
)
from transport.models import Route, Stop


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
