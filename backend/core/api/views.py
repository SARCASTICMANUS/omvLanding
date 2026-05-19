# VAYY | core/api/views.py | Status: ✅ Public Transport Refactor
# Converted from University/Student to City/Passenger/Driver model.

import os
import json
import secrets
from datetime import timedelta
import logging
from rest_framework import viewsets, status
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated, AllowAny
from django.contrib.gis.geos import Point, LineString
from django.contrib.auth import authenticate
from django.utils import timezone
from django.db import transaction
import openpyxl
from rest_framework_simplejwt.tokens import RefreshToken
from core.utils import _run, get_table_eta_async
from core.services.geocoding import (
    GeocodingUnavailable,
    reverse_location,
    search_locations,
)
from core.services.routes import (
    create_route_from_payload,
    get_next_stops_for_trip,
    normalize_route_points,
)

from core.models import (
    City,
    Route,
    Stop,
    Vehicle,
    ActiveTrip,
    PublicPassengerProfile,
    PublicDriverProfile,
    BoardingRequest,
    TripSchedule,
    StopTime,
)
from core.utils import create_route_geometry
from core.api.serializers import (
    CitySerializer,
    RouteSerializer,
    StopSerializer,
    VehicleSerializer,
    RegisterSerializer,
    UserSerializer,
    ActiveTripSerializer,
    PublicDriverProfileSerializer,
    PassengerProfileSerializer,
    BoardingRequestSerializer,
    ImportRouteSerializer,
)
from allauth.socialaccount.providers.google.views import GoogleOAuth2Adapter
from allauth.socialaccount.providers.oauth2.client import OAuth2Client
from dj_rest_auth.registration.views import SocialLoginView

logger = logging.getLogger(__name__)

OTP_EXPIRY_MINUTES = 10


class GoogleLogin(SocialLoginView):
    adapter_class = GoogleOAuth2Adapter
    callback_url = "http://localhost:3000"
    client_class = OAuth2Client


# ─── Helper: make / decode verification token ─────────────────────────────────


def _make_verification_token(user):
    import hmac, hashlib, time, base64

    payload = f"{user.id}:{int(time.time())}"
    secret = os.environ.get("SECRET_KEY", "vayy-dev-secret")
    sig = hmac.new(secret.encode(), payload.encode(), hashlib.sha256).hexdigest()
    raw = f"{payload}:{sig}"
    return base64.urlsafe_b64encode(raw.encode()).decode()


def _decode_verification_token(token, max_age_seconds=600):
    import hmac, hashlib, time, base64

    try:
        raw = base64.urlsafe_b64decode(token.encode()).decode()
        parts = raw.rsplit(":", 2)
        if len(parts) != 3:
            return None, False, "Invalid token format"
        user_id, ts_str, sig = parts
        ts = int(ts_str)
        if time.time() - ts > max_age_seconds:
            return None, False, "Token expired"
        payload = f"{user_id}:{ts_str}"
        secret = os.environ.get("SECRET_KEY", "vayy-dev-secret")
        expected_sig = hmac.new(
            secret.encode(), payload.encode(), hashlib.sha256
        ).hexdigest()
        if not hmac.compare_digest(sig, expected_sig):
            return None, False, "Invalid token signature"
        return int(user_id), True, None
    except Exception as e:
        return None, False, str(e)


# ─── ViewSets ─────────────────────────────────────────────────────────────────


class CityViewSet(viewsets.ModelViewSet):
    permission_classes = [AllowAny]
    queryset = City.objects.all().order_by("name")
    serializer_class = CitySerializer


class VehicleViewSet(viewsets.ModelViewSet):
    queryset = Vehicle.objects.select_related("city", "route", "driver").all()
    serializer_class = VehicleSerializer

    def get_queryset(self):
        qs = self.queryset
        city_id = self.request.query_params.get("city")
        if city_id:
            qs = qs.filter(city_id=city_id)
        return qs


class PublicDriverProfileViewSet(viewsets.ModelViewSet):
    queryset = PublicDriverProfile.objects.all()
    serializer_class = PublicDriverProfileSerializer

    def get_queryset(self):
        qs = self.queryset
        city_id = self.request.query_params.get("city")
        if city_id:
            qs = qs.filter(user__city_id=city_id)
        is_verified = self.request.query_params.get("is_verified")
        if is_verified is not None:
            qs = qs.filter(is_verified=is_verified.lower() == "true")
        return qs


class PassengerProfileViewSet(viewsets.ModelViewSet):
    queryset = PublicPassengerProfile.objects.all()
    serializer_class = PassengerProfileSerializer

    def get_queryset(self):
        qs = self.queryset
        city_id = self.request.query_params.get("city")
        if city_id:
            qs = qs.filter(user__city_id=city_id)
        return qs


class UserViewSet(viewsets.ModelViewSet):
    from django.contrib.auth import get_user_model

    User = get_user_model()
    queryset = User.objects.all()
    serializer_class = UserSerializer

    def get_queryset(self):
        qs = self.queryset
        city_id = self.request.query_params.get("city")
        role = self.request.query_params.get("role")
        if city_id:
            qs = qs.filter(city_id=city_id)
        if role:
            qs = qs.filter(role=role)
        return qs


class BoardingRequestViewSet(viewsets.ModelViewSet):
    """
    Allow passengers to 'book' a spot at a stop for a specific trip.
    Drivers can see these in their digital manifest via WebSocket or API.
    """

    permission_classes = [IsAuthenticated]
    queryset = BoardingRequest.objects.all()
    serializer_class = BoardingRequestSerializer

    def get_queryset(self):
        user = self.request.user
        if user.role == "driver":
            # Drivers see requests for their active trips
            return BoardingRequest.objects.filter(
                trip__driver=user, status__in=["pending", "approaching", "boarded"]
            )
        # Passengers see their own requests
        return BoardingRequest.objects.filter(passenger=user)

    def perform_create(self, serializer):
        boarding_request = serializer.save(passenger=self.request.user)
        # Trigger manifest update task
        from core.tasks import update_driver_manifest

        update_driver_manifest.delay(str(boarding_request.trip_id))

    from rest_framework.decorators import action

    @action(detail=True, methods=["post"])
    def update_status(self, request, pk=None):
        boarding_request = self.get_object()
        new_status = request.data.get("status")
        if new_status in dict(BoardingRequest.STATUS_CHOICES):
            boarding_request.status = new_status
            boarding_request.save()

            # Broadcast manifest update
            from core.tasks import update_driver_manifest

            update_driver_manifest.delay(str(boarding_request.trip_id))

            return Response({"status": "updated"})
        return Response({"error": "invalid status"}, status=400)

    def destroy(self, request, *args, **kwargs):
        boarding_request = self.get_object()
        trip_id = str(boarding_request.trip_id)
        response = super().destroy(request, *args, **kwargs)

        # Update manifest after deletion
        from core.tasks import update_driver_manifest

        update_driver_manifest.delay(trip_id)
        return response


# ─── Global Location Search ───────────────────────────────────────────────────


class GlobalSearchView(APIView):
    permission_classes = [AllowAny]

    def get(self, request):
        query = request.query_params.get("q")
        if not query:
            return Response([])
        try:
            return Response(search_locations(query, limit=5))
        except GeocodingUnavailable:
            return Response({"error": "Search service busy"}, status=503)
        except Exception:
            return Response([], status=200)


class ReverseSearchView(APIView):
    permission_classes = [AllowAny]

    def get(self, request):
        lat = request.query_params.get("lat")
        lon = request.query_params.get("lon")
        if not lat or not lon:
            return Response({"error": "lat and lon are required"}, status=400)
        try:
            location = reverse_location(lat, lon)
            if location:
                return Response(location)
            return Response({"error": "No location found"}, status=404)
        except GeocodingUnavailable:
            return Response({"error": "Search service busy"}, status=503)
        except Exception as e:
            return Response({"error": str(e)}, status=500)


# ─── Route Management ─────────────────────────────────────────────────────────


class AdminRouteView(APIView):
    def get(self, request):
        city_id = request.query_params.get("city")
        routes = Route.objects.all()
        if city_id:
            routes = routes.filter(city_id=city_id)
        serializer = RouteSerializer(routes, many=True)
        return Response(serializer.data)

    def post(self, request):
        start = request.data.get("start")
        end = request.data.get("end")
        custom_geometry = request.data.get("path")

        if not custom_geometry and (not start or not end):
            return Response(
                {"error": "Start and end locations are required for new routes."},
                status=400,
            )

        try:
            route = create_route_from_payload(request.data)
        except (KeyError, TypeError, ValueError) as e:
            return Response({"error": f"Invalid location format: {e}"}, status=400)

        if route is None:
            return Response(
                {"error": "Routing service unreachable or could not calculate route"},
                status=status.HTTP_503_SERVICE_UNAVAILABLE,
            )

        return Response(RouteSerializer(route).data, status=201)

    def put(self, request):
        route_id = request.query_params.get("id")
        try:
            route = Route.objects.get(id=route_id)
        except Route.DoesNotExist:
            return Response({"error": "Route not found"}, status=404)
        for field in ["name", "bus_number", "start_name", "end_name", "is_public"]:
            if field in request.data:
                setattr(route, field, request.data[field])
        route.save()
        return Response(RouteSerializer(route).data)

    def delete(self, request):
        route_id = request.query_params.get("id")
        Route.objects.filter(id=route_id).delete()
        return Response(status=204)


class AdminRoutePreviewView(APIView):
    def post(self, request):
        start = request.data.get("start")
        end = request.data.get("end")
        stops_data = request.data.get("stops", [])

        if not start or not end:
            return Response(
                {"error": "Start and end locations are required."}, status=400
            )

        try:
            _, waypoints = normalize_route_points(start, end, stops_data)
        except (KeyError, TypeError, ValueError) as e:
            return Response({"error": f"Invalid location data format: {e}"}, status=400)

        route_options = create_route_geometry(waypoints, alternatives=True)
        if route_options is None:
            # Check if this was a connection error vs no routes found
            # (Note: create_route_geometry returns None for both currently)
            return Response(
                {"error": "Routing service unreachable or no routes found"},
                status=status.HTTP_503_SERVICE_UNAVAILABLE,
            )

        if not route_options:
            return Response(
                {"error": "No routes found between these points"}, status=404
            )

        output = []
        for r in route_options:
            # Assuming r["geometry"] is a shapely object or has coordinates
            # Try to handle it if it is a list or has a coords property
            coords = []
            if hasattr(r["geometry"], "coords"):
                coords = list(r["geometry"].coords)
            elif isinstance(r["geometry"], list):
                coords = r["geometry"]
            else:
                # Fallback: try decoding polyline if provided as encoded string
                # or log an error
                logging.error(f"Unknown geometry format: {type(r['geometry'])}")

            output.append(
                {
                    "path": [[x, y] for x, y in coords],
                    "distance": r["total_distance"],
                    "duration": r["duration"],
                }
            )
        return Response(output)


class BulkImportView(APIView):
    """
    Bulk import routes, stops, and timings from JSON or XLSX files.
    Skips invalid records and returns a summary of the operation.
    """

    # permission_classes = [IsAuthenticated] # Optional: restrict to authenticated users

    def post(self, request):
        file_obj = request.FILES.get("file")
        city_id = request.data.get("city_id")

        if not file_obj:
            return Response({"error": "No file uploaded"}, status=400)

        file_name = file_obj.name
        try:
            if file_name.endswith(".json"):
                data = json.load(file_obj)
                if not isinstance(data, list):
                    data = [data]
                parsed_routes = data
            elif file_name.endswith((".xlsx", ".xls")):
                parsed_routes = self._parse_excel(file_obj)
            else:
                return Response(
                    {"error": "Unsupported file format. Use JSON or XLSX."}, status=400
                )
        except Exception as e:
            return Response({"error": f"Failed to parse file: {str(e)}"}, status=400)

        summary = {"total": len(parsed_routes), "success": 0, "failed": 0, "errors": []}

        for route_data in parsed_routes:
            # Inject city_id if not present in route_data but provided in request
            if not route_data.get("city_id") and city_id:
                route_data["city_id"] = city_id

            serializer = ImportRouteSerializer(data=route_data)
            if not serializer.is_valid():
                summary["failed"] += 1
                summary["errors"].append(
                    {
                        "route": route_data.get("name", "Unknown"),
                        "reason": serializer.errors,
                    }
                )
                continue

            validated_data = serializer.validated_data
            try:
                with transaction.atomic():
                    self._create_route_full(validated_data)
                    summary["success"] += 1
            except Exception as e:
                summary["failed"] += 1
                summary["errors"].append(
                    {"route": validated_data.get("name"), "reason": str(e)}
                )

        return Response(
            summary,
            status=(
                status.HTTP_201_CREATED
                if summary["success"] > 0
                else status.HTTP_200_OK
            ),
        )

    def _parse_excel(self, file_obj):
        wb = openpyxl.load_workbook(file_obj, data_only=True)
        ws = wb.active
        rows = list(ws.iter_rows(values_only=True))
        if not rows:
            return []

        header = [str(cell).lower().strip() if cell else "" for cell in rows[0]]
        data_rows = rows[1:]

        routes_map = {}

        for row in data_rows:
            row_dict = dict(zip(header, row))
            route_name = row_dict.get("route_name") or row_dict.get("name")
            if not route_name:
                continue

            if route_name not in routes_map:
                routes_map[route_name] = {
                    "name": route_name,
                    "bus_number": str(row_dict.get("bus_number") or ""),
                    "start_name": row_dict.get("start_name", "Start"),
                    "end_name": row_dict.get("end_name", "End"),
                    "stops": [],
                    "schedules": {},
                }

            route = routes_map[route_name]

            # Add stop if present
            stop_name = row_dict.get("stop_name")
            stop_lat = row_dict.get("stop_lat")
            stop_lon = row_dict.get("stop_lon")
            if stop_name and stop_lat is not None and stop_lon is not None:
                # Check if stop already exists in this route
                existing_stop = next(
                    (s for s in route["stops"] if s["name"] == stop_name), None
                )
                if not existing_stop:
                    route["stops"].append(
                        {
                            "name": stop_name,
                            "lat": float(stop_lat),
                            "lon": float(stop_lon),
                            "order": int(
                                row_dict.get("stop_order") or len(route["stops"])
                            ),
                        }
                    )

            # Add schedule if present
            sched_label = row_dict.get("schedule_label")
            sched_start = row_dict.get("schedule_start_time")
            if sched_label and sched_start:
                if sched_label not in route["schedules"]:
                    route["schedules"][sched_label] = {
                        "label": sched_label,
                        "start_time": sched_start,
                        "stop_times": [],
                    }

                arrival_time = row_dict.get("arrival_time")
                if arrival_time:
                    route["schedules"][sched_label]["stop_times"].append(
                        {"stop_name": stop_name, "arrival_time": arrival_time}
                    )

        # Convert schedules map to list
        for route in routes_map.values():
            route["schedules"] = list(route["schedules"].values())
            # Sort stops by order
            route["stops"].sort(key=lambda x: x["order"])

        return list(routes_map.values())

    def _create_route_full(self, data):
        stops_data = data.pop("stops")
        schedules_data = data.pop("schedules", [])
        city_id = data.get("city_id")

        # 1. Create Route Geometry
        waypoints = [(s["lon"], s["lat"]) for s in stops_data]
        route_geo = create_route_geometry(waypoints)

        path = route_geo["geometry"] if route_geo else LineString(waypoints, srid=4326)
        distance = route_geo["total_distance"] if route_geo else 0

        route = Route.objects.create(
            city_id=city_id,
            name=data["name"],
            bus_number=data.get("bus_number", ""),
            start_name=data.get("start_name", "Start"),
            end_name=data.get("end_name", "End"),
            path=path,
            total_distance_meters=distance,
            is_public=data.get("is_public", True),
        )

        # 2. Create Stops
        stops_map = {}
        for s in stops_data:
            stop = Stop.objects.create(
                route=route,
                name=s["name"],
                location=Point(s["lon"], s["lat"], srid=4326),
                order=s["order"],
            )
            stops_map[s["name"]] = stop

        # 3. Create Schedules
        for s_data in schedules_data:
            schedule = TripSchedule.objects.create(
                route=route,
                label=s_data["label"],
                scheduled_start_time=s_data["start_time"],
            )

            # 4. Create StopTimes
            for st_idx, st_data in enumerate(s_data["stop_times"]):
                stop = stops_map.get(st_data["stop_name"])
                if stop:
                    StopTime.objects.create(
                        trip_schedule=schedule,
                        stop=stop,
                        arrival_time=st_data["arrival_time"],
                        stop_sequence=st_idx,
                    )


# ─── Driver Views ─────────────────────────────────────────────────────────────


class DriverStartTripView(APIView):
    def get(self, request):
        """Return all public routes (optionally filtered by city) for route selection."""
        city_id = request.query_params.get("city") or (
            str(request.user.city_id) if request.user.city_id else None
        )
        routes = Route.objects.filter(is_public=True)
        if city_id:
            routes = routes.filter(city_id=city_id)

        return Response(
            [
                {
                    "id": r.id,
                    "name": f"{r.name} ({r.start_name} → {r.end_name})",
                    "total_distance": r.total_distance_meters,
                    "stops_count": r.stops.count(),
                    "bus_number": r.bus_number,
                    "city": str(r.city_id) if r.city_id else None,
                }
                for r in routes
            ]
        )

    def post(self, request):
        route_id = request.data.get("route_id")
        vehicle_id = request.data.get("vehicle_id")

        # One-active-trip constraint (auto-resume if already active)
        existing = ActiveTrip.objects.filter(
            driver=request.user, status="active"
        ).first()
        if existing:
            return self._format_trip_response(existing, resumed=True)

        try:
            route = Route.objects.get(id=route_id)
            vehicle = None
            if vehicle_id:
                vehicle = Vehicle.objects.get(id=vehicle_id)
            else:
                vehicle = Vehicle.objects.filter(driver=request.user).first()
        except (Route.DoesNotExist, Vehicle.DoesNotExist):
            return Response({"error": "Route or Vehicle not found"}, status=404)

        trip = ActiveTrip.objects.create(
            route=route,
            vehicle=vehicle,
            driver=request.user,
            status="active",
        )

        # Broadcast trip started alert to driver's user group
        from asgiref.sync import async_to_sync
        from channels.layers import get_channel_layer

        channel_layer = get_channel_layer()
        if channel_layer:
            async_to_sync(channel_layer.group_send)(
                f"user_{request.user.id}",
                {
                    "type": "trip_started",
                    "trip_id": str(trip.id),
                    "route_name": route.name,
                    "message": f"Your trip for route {route.name} has started.",
                },
            )

        # Increment driver's total trips
        try:
            profile = request.user.driver_profile
            profile.total_trips += 1
            profile.save(update_fields=["total_trips"])
        except Exception:
            pass

        return self._format_trip_response(trip, resumed=False)

    def _format_trip_response(self, trip, *, resumed=False):
        return Response(
            {
                "trip_id": str(trip.id),
                "route_geometry": [[y, x] for x, y in trip.route.path.coords],
                "total_distance": trip.route.total_distance_meters,
                "stops": StopSerializer(trip.route.stops.all(), many=True).data,
                "bus_number": trip.route.bus_number,
                "route_name": trip.route.name,
                "resumed": resumed,
            }
        )


class TripEndView(APIView):
    def post(self, request, trip_id):
        try:
            trip = ActiveTrip.objects.get(id=trip_id, driver=request.user)
            trip.status = "inactive"
            trip.save()
            return Response({"status": "inactive"})
        except ActiveTrip.DoesNotExist:
            return Response({"error": "Trip not found"}, status=404)


class TripNextStopsView(APIView):
    """Return waiting passenger counts for next 3 stops on the trip."""

    def get(self, request, trip_id):
        try:
            trip = ActiveTrip.objects.get(id=trip_id)
        except ActiveTrip.DoesNotExist:
            return Response({"error": "Trip not found"}, status=404)

        return Response(get_next_stops_for_trip(trip))


class DriverTripStatusView(APIView):
    """Compatibility endpoint for the driver console polling loop."""

    def get(self, request, trip_id):
        try:
            trip = ActiveTrip.objects.select_related("route", "vehicle", "driver").get(
                id=trip_id
            )
        except ActiveTrip.DoesNotExist:
            return Response({"error": "Trip not found"}, status=404)

        requests = BoardingRequest.objects.filter(
            trip=trip, status__in=["pending", "approaching", "boarded"]
        ).select_related("passenger", "pickup_stop")

        return Response(
            {
                "trip_id": str(trip.id),
                "status": trip.status,
                "next_stops": get_next_stops_for_trip(trip),
                "passengers": {
                    str(req.passenger_id): {
                        "id": str(req.passenger_id),
                        "name": req.passenger.get_full_name() or req.passenger.email,
                        "stop_id": str(req.pickup_stop_id),
                        "stop_name": req.pickup_stop.name,
                        "status": req.status,
                    }
                    for req in requests
                },
            }
        )


# ─── Passenger Views ──────────────────────────────────────────────────────────


class PassengerMatchView(APIView):
    """Find active trips on routes near the passenger's location."""

    def post(self, request):
        lat = request.data.get("lat")
        lon = request.data.get("lon")
        radius_deg = float(request.data.get("radius", 0.1))  # ~11km
        p_point = Point(float(lon), float(lat), srid=4326)

        routes = Route.objects.filter(
            path__dwithin=(p_point, radius_deg), is_public=True
        )
        cutoff = timezone.now() - timedelta(seconds=90)
        active_trips = ActiveTrip.objects.filter(
            route__in=routes, status="active", last_updated__gte=cutoff
        ).select_related("route", "vehicle", "driver")

        matches = []
        for trip in active_trips:
            matches.append(
                {
                    "trip_id": str(trip.id),
                    "vehicle_number": (
                        trip.vehicle.vehicle_number if trip.vehicle else "N/A"
                    ),
                    "route_name": trip.route.name,
                    "bus_number": trip.route.bus_number,
                    "driver_name": trip.driver.get_full_name() if trip.driver else "",
                    "route_id": str(trip.route_id),
                }
            )
        return Response(matches)


class PassengerNearbyStopsView(APIView):
    """Return stops near a given location — no city filter, open to all."""

    def get(self, request):
        lat = request.query_params.get("lat")
        lon = request.query_params.get("lon")
        radius = float(
            request.query_params.get("radius_m")
            or request.query_params.get("radius", 1500)
        )
        if radius <= 1:
            radius *= 111_320

        if not lat or not lon:
            return Response({"error": "lat and lon are required"}, status=400)

        p_point = Point(float(lon), float(lat), srid=4326)
        stops = (
            Stop.objects.filter(
                location__dwithin=(p_point, radius),
                route__is_public=True,
            )
            .select_related("route")
            .annotate(distance=Distance("location", p_point))
            .order_by("distance", "order")[:20]
        )

        return Response(
            [
                {
                    **StopSerializer(stop).data,
                    "route_id": str(stop.route_id),
                    "route_name": stop.route.name,
                    "distance_meters": round(stop.distance.m),
                }
                for stop in stops
            ]
        )


class PassengerTripDetailView(APIView):
    """Return full details for a specific active trip."""

    def get(self, request, trip_id):
        try:
            trip = ActiveTrip.objects.select_related("route", "vehicle", "driver").get(
                id=trip_id
            )
        except (ActiveTrip.DoesNotExist, ValueError):
            return Response({"error": "Trip not found"}, status=404)

        stops = list(trip.route.stops.order_by("order"))

        return Response(
            {
                "trip_id": str(trip.id),
                "bus_number": trip.route.bus_number,
                "route_name": trip.route.name,
                "route_geometry": [[y, x] for x, y in trip.route.path.coords],
                "driver_name": trip.driver.get_full_name() if trip.driver else "",
                "vehicle_number": (
                    trip.vehicle.vehicle_number if trip.vehicle else "N/A"
                ),
                "stops": [
                    {
                        "id": str(s.id),
                        "name": s.name,
                        "lat": s.location.y,
                        "lon": s.location.x,
                        "order": s.order,
                    }
                    for s in stops
                ],
                "status": trip.status,
                "last_updated": trip.last_updated,
            }
        )


class PassengerDashboardView(APIView):
    """
    Open dashboard: returns active trips near the passenger.
    No assignment needed — any passenger can see any active bus.
    """

    def get(self, request):
        lat = request.query_params.get("lat")
        lon = request.query_params.get("lon")
        cutoff = timezone.now() - timedelta(seconds=90)

        active_trips = ActiveTrip.objects.filter(
            status="active", last_updated__gte=cutoff
        ).select_related("route", "vehicle", "driver")

        # Optional: filter by location if provided
        if lat and lon:
            p_point = Point(float(lon), float(lat), srid=4326)
            radius = float(request.query_params.get("radius", 0.2))
            active_trips = active_trips.filter(route__path__dwithin=(p_point, radius))

        trip_data = []
        for trip in active_trips:
            # Include basic stop info for distance calculation on frontend
            stops = trip.route.stops.order_by("order")[:3]
            trip_data.append(
                {
                    "trip_id": str(trip.id),
                    "bus_number": trip.route.bus_number,
                    "route_name": trip.route.name,
                    "route_geometry": [[y, x] for x, y in trip.route.path.coords],
                    "driver_name": trip.driver.get_full_name() if trip.driver else "",
                    "vehicle_number": (
                        trip.vehicle.vehicle_number if trip.vehicle else "N/A"
                    ),
                    "stops": [
                        {"name": s.name, "lat": s.location.y, "lon": s.location.x}
                        for s in stops
                    ],
                }
            )

        return Response(
            {
                "active_trips": trip_data,
                "total_active": len(trip_data),
            }
        )


from django.db.models import F, Q
from django.db.models.functions import Cast
from django.contrib.gis.db.models import GeometryField
from django.contrib.gis.db.models.functions import Distance, LineLocatePoint
from core.services.redis_service import (
    get_redis_client,
    add_recent_search,
    get_recent_searches,
)

# Redis setup (sync for view)
r_client = get_redis_client()


class PassengerFilteredTripsView(APIView):
    """
    Filter active trips based on pickup and destination.
    Returns trips whose route passes near BOTH points,
    where pickup comes BEFORE destination on the route,
    and the vehicle hasn't passed the pickup point yet.
    """

    permission_classes = [IsAuthenticated]

    def post(self, request):
        pickup_data = request.data.get("pickup")  # {lat, lon, name}
        dest_data = request.data.get("destination")  # {lat, lon, name}
        print(f"PassengerFilteredTrips: request pickup={pickup_data}, dest={dest_data}")

        if not pickup_data or not dest_data:
            return Response(
                {"error": "Pickup and destination are required"}, status=400
            )

        # Save to recent searches in Redis
        try:
            add_recent_search(
                request.user.id, {"pickup": pickup_data, "destination": dest_data}
            )
        except Exception as e:
            logger.error(f"Failed to save recent search: {e}")

        p_lat, p_lon = float(pickup_data["lat"]), float(pickup_data["lon"])
        d_lat, d_lon = float(dest_data["lat"]), float(dest_data["lon"])
        p_point = Point(p_lon, p_lat, srid=4326)
        d_point = Point(d_lon, d_lat, srid=4326)

        # 1. Find candidate routes via multiple strategies
        radius_m = float(request.data.get("radius_m", 5000))  # Increased default to 5km
        routes = Route.objects.none()

        # STRATEGY A: Path-based matching (DWithin)
        routes_geo = (
            Route.objects.filter(
                Q(path__dwithin=(p_point, radius_m))
                & Q(path__dwithin=(d_point, radius_m))
            )
            .annotate(
                p_frac=LineLocatePoint(Cast("path", GeometryField()), p_point),
                d_frac=LineLocatePoint(Cast("path", GeometryField()), d_point),
            )
            .filter(p_frac__lt=F("d_frac") + 0.1)
        )  # Increased buffer

        routes = routes_geo

        # STRATEGY B: Name-based fallback (Resilient to geocoding differences)
        if not routes.exists() and ("name" in pickup_data or "name" in dest_data):
            p_name = pickup_data.get("name", "").lower()
            d_name = dest_data.get("name", "").lower()

            # Match by start/end names or route name - using words for better match
            p_terms = [t for t in p_name.replace(",", " ").split() if len(t) > 2]
            d_terms = [t for t in d_name.replace(",", " ").split() if len(t) > 2]

            if p_terms and d_terms:
                name_q = Q()
                for t in p_terms:
                    name_q |= Q(start_name__icontains=t) | Q(name__icontains=t)
                dest_q = Q()
                for t in d_terms:
                    dest_q |= Q(end_name__icontains=t) | Q(name__icontains=t)

                name_routes = Route.objects.filter(name_q & dest_q).annotate(
                    p_frac=LineLocatePoint(Cast("path", GeometryField()), p_point),
                    d_frac=LineLocatePoint(Cast("path", GeometryField()), d_point),
                )
                routes = name_routes

        # STRATEGY C: Wide Stop Proximity Fallback
        if not routes.exists():
            wide_radius = radius_m * 2  # 10km fallback
            p_stop_routes = Stop.objects.filter(
                location__dwithin=(p_point, wide_radius)
            ).values_list("route_id", flat=True)
            d_stop_routes = Stop.objects.filter(
                location__dwithin=(d_point, wide_radius)
            ).values_list("route_id", flat=True)
            common_route_ids = set(p_stop_routes) & set(d_stop_routes)
            if common_route_ids:
                routes = Route.objects.filter(id__in=common_route_ids).annotate(
                    p_frac=LineLocatePoint(Cast("path", GeometryField()), p_point),
                    d_frac=LineLocatePoint(Cast("path", GeometryField()), d_point),
                )

        if not routes.exists():
            print("PassengerFilteredTrips: No routes found after all fallbacks")
            return Response([])

        def serialize_route_candidate(route):
            stops = list(route.stops.order_by("order"))
            return {
                "trip_id": f"route-{route.id}",
                "route_id": str(route.id),
                "is_route_only": True,
                "trip_available": False,
                "bus_number": route.bus_number or "Route Match",
                "vehicle_number": route.bus_number or "No active bus",
                "route_name": route.name,
                "pickup_name": route.start_name,
                "destination_name": route.end_name,
                "route_geometry": (
                    [[y, x] for x, y in route.path.coords] if route.path else []
                ),
                "path_coords": (
                    [[y, x] for x, y in route.path.coords] if route.path else []
                ),
                "distance_text": (
                    f"{round((route.total_distance_meters or 0) / 1000, 1)} km"
                    if route.total_distance_meters
                    else ""
                ),
                "duration_text": "",
                "stops_count": len(stops),
                "stops": [
                    {
                        "id": str(s.id),
                        "name": s.name,
                        "lat": s.location.y,
                        "lon": s.location.x,
                        "order": s.order,
                    }
                    for s in stops
                ],
                "next_stop": stops[0].name if stops else "N/A",
                "eta_seconds": 0,
                "current_lat": p_lat,
                "current_lon": p_lon,
            }

        # 2. Find active trips
        # Cutoff set to 15 minutes to be very lenient with inactive/slow updates
        cutoff = timezone.now() - timedelta(seconds=900)
        active_trips = ActiveTrip.objects.filter(
            route__in=routes, status="active", last_updated__gte=cutoff
        ).select_related("route", "vehicle", "driver")

        if not active_trips.exists():
            print(
                f"PassengerFilteredTrips: Found {routes.count()} routes, but no active trips within 15m cutoff"
            )
            return Response([serialize_route_candidate(route) for route in routes])

        results = []
        route_frac_map = {r.id: getattr(r, "p_frac", 0) for r in routes}

        for trip in active_trips:
            # Check Redis for the absolutely most recent position
            curr_pos = None
            curr_loc_raw = r_client.get(f"driver_pos:{trip.id}")
            if curr_loc_raw:
                try:
                    # Redis client has decode_responses=True, so curr_loc_raw is already a string
                    lon_s, lat_s = curr_loc_raw.split(",")
                    curr_pos = (float(lon_s), float(lat_s))
                except (ValueError, AttributeError):
                    curr_pos = None
            
            if not curr_pos:
                if trip.current_location:
                    curr_pos = (trip.current_location.x, trip.current_location.y)
                else:
                    # Fallback to start of route
                    curr_pos = (trip.route.path.coords[0][0], trip.route.path.coords[0][1])

            # DIRECTIONAL CHECK: Has the bus passed the pickup?
            c_point = Point(curr_pos[0], curr_pos[1], srid=4326)

            # Annotate current fraction for this trip specifically
            c_frac_data = (
                Route.objects.filter(id=trip.route_id)
                .annotate(
                    c_frac=LineLocatePoint(Cast("path", GeometryField()), c_point)
                )
                .values("c_frac")
                .first()
            )

            curr_frac = c_frac_data["c_frac"] if c_frac_data else 0
            pickup_frac = route_frac_map.get(trip.route_id, 0)

            # Bus is eligible if it hasn't passed the pickup by more than a 5% margin (lenient)
            if curr_frac > (pickup_frac + 0.05):
                continue

            stops = list(trip.route.stops.order_by("order"))
            next_stop_name = "N/A"
            eta_seconds = 0

            if stops:
                # OSRM ETA calculation
                sources = [curr_pos]
                destinations = [(s.location.x, s.location.y) for s in stops]
                table = _run(get_table_eta_async(sources, destinations))
                if table and table.get("durations"):
                    durations = table["durations"][0]
                    # Find first stop ahead of bus
                    for idx, s in enumerate(stops):
                        if durations[idx] > 0:
                            next_stop_name = s.name
                            eta_seconds = durations[idx]
                            break

            results.append(
                {
                    "trip_id": str(trip.id),
                    "route_id": str(trip.route.id),
                    "bus_number": trip.route.bus_number,
                    "vehicle_number": (
                        trip.vehicle.vehicle_number if trip.vehicle else "N/A"
                    ),
                    "route_name": trip.route.name,
                    "pickup_name": trip.route.start_name,
                    "destination_name": trip.route.end_name,
                    "route_geometry": (
                        [[y, x] for x, y in trip.route.path.coords]
                        if trip.route.path
                        else []
                    ),
                    "path_coords": (
                        [[y, x] for x, y in trip.route.path.coords]
                        if trip.route.path
                        else []
                    ),
                    "distance_text": (
                        f"{round((trip.route.total_distance_meters or 0) / 1000, 1)} km"
                        if trip.route.total_distance_meters
                        else ""
                    ),
                    "stops_count": trip.route.stops.count(),
                    "stops": [
                        {
                            "id": str(s.id),
                            "name": s.name,
                            "lat": s.location.y,
                            "lon": s.location.x,
                            "order": s.order,
                        }
                        for s in stops
                    ],
                    "next_stop": next_stop_name,
                    "eta_seconds": eta_seconds,
                    "current_lat": curr_pos[1],
                    "current_lon": curr_pos[0],
                }
            )

        if not results:
            print(
                "PassengerFilteredTrips: Found active trips but none headed towards pickup point"
            )
            return Response([serialize_route_candidate(route) for route in routes])

        return Response(results)


class PassengerRecentSearchesView(APIView):
    """Returns the last 3 searches for the authenticated passenger."""

    permission_classes = [IsAuthenticated]

    def get(self, request):
        try:
            searches = get_recent_searches(request.user.id)
            return Response(searches)
        except Exception as e:
            logger.error(f"Failed to fetch recent searches: {e}")
            return Response([], status=200)


# ─── Ingestion Views ──────────────────────────────────────────────────────────


class TelemetryIngestView(APIView):
    """
    High-performance ingestion endpoint for GPS and Hybrid location data.
    Ensures < 50ms response time by offloading processing.
    """

    permission_classes = [IsAuthenticated]

    def post(self, request):
        data = request.data
        t_type = data.get("type")
        trip_id = data.get("trip_id")
        user = request.user

        if not t_type:
            return Response({"error": "type is required"}, status=400)

        # 1. Handle Hybrid Signal Data (Cell/Wi-Fi)
        if t_type == "hybrid":
            # Package for Redis Stream (Consumer will save to HybridLog)
            stream_payload = {
                "user_id": str(user.id),
                "trip_id": str(trip_id) if trip_id else "",
                "cell_towers": json.dumps(data.get("cell_towers", [])),
                "wifi_aps": json.dumps(data.get("wifi_aps", [])),
                "device_id": data.get("device_id", ""),
                "timestamp": str(timezone.now().timestamp()),
            }
            try:
                r_client.xadd("raw_signal_stream", stream_payload)
            except Exception as e:
                logger.error(f"Redis Stream Error: {e}")
                # Fallback to direct DB save if Redis is down (slower but safe)
                # For now, we prioritize 200 OK

            return Response({"status": "queued"}, status=200)

        # 2. Handle Standard GPS Data
        elif t_type == "gps":
            lat = data.get("lat")
            lon = data.get("lon")

            if not lat or not lon or not trip_id:
                return Response(
                    {"error": "lat, lon, and trip_id are required for GPS"}, status=400
                )

            # Use shared logic for Redis update and WebSocket broadcast
            from core.utils import process_gps_update

            process_gps_update(trip_id=trip_id, lat=lat, lon=lon, source="gps")

            return Response({"status": "received"}, status=200)

        return Response({"error": "invalid telemetry type"}, status=400)


# ─── Auth Views ───────────────────────────────────────────────────────────────


class MeView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        serializer = UserSerializer(request.user)
        return Response(serializer.data)


class AuthView(APIView):
    permission_classes = [AllowAny]

    def post(self, request, action):
        from django.contrib.auth import get_user_model

        User = get_user_model()

        # ── Register ──────────────────────────────────────────────────────────
        if action == "register":
            serializer = RegisterSerializer(data=request.data)
            if serializer.is_valid():
                user = serializer.save()
                refresh = RefreshToken.for_user(user)
                return Response(
                    {
                        "refresh": str(refresh),
                        "access": str(refresh.access_token),
                        "user": {"email": user.email, "role": user.role},
                    }
                )
            return Response(serializer.errors, status=400)

        # ── Login ─────────────────────────────────────────────────────────────
        elif action == "login":
            email = request.data.get("email")
            password = request.data.get("password")
            user = authenticate(username=email, password=password)
            if user:
                refresh = RefreshToken.for_user(user)
                user_role = "admin" if user.is_superuser else user.role
                return Response(
                    {
                        "refresh": str(refresh),
                        "access": str(refresh.access_token),
                        "role": user_role,
                        "city": str(user.city_id) if user.city_id else None,
                        "name": f"{user.first_name} {user.last_name}".strip()
                        or user.email,
                        "email": user.email,
                    }
                )
            return Response({"error": "Invalid credentials"}, status=401)

        # ── Send OTP ──────────────────────────────────────────────────────────
        elif action == "send-otp":
            email = request.data.get("email")
            if not email:
                return Response({"error": "Email is required"}, status=400)

            user = User.objects.filter(email=email).first()
            if not user:
                user = User.objects.create(
                    email=email,
                    username=email,
                    role="passenger",  # Default to passenger for public
                    is_active=True,
                )
                user.set_unusable_password()
                user.save(update_fields=["password"])

            user.otp = "123456"
            user.otp_verified = False
            user.otp_created_at = timezone.now()
            user.save(update_fields=["otp", "otp_verified", "otp_created_at"])

            logger.info(f"[OTP] Generated dummy code 123456 for {email}")
            return Response({"message": f"OTP sent to {email}"}, status=200)

        # ── Verify OTP ────────────────────────────────────────────────────────
        elif action == "verify-otp":
            email = request.data.get("email")
            otp = request.data.get("otp")
            if not email or not otp:
                return Response({"error": "Email and OTP are required"}, status=400)

            try:
                user = User.objects.get(email=email)
            except User.DoesNotExist:
                return Response({"error": "User not found"}, status=404)

            if user.otp != otp:
                return Response({"error": "Invalid OTP"}, status=400)

            if user.otp_created_at:
                age = timezone.now() - user.otp_created_at
                if age > timedelta(minutes=OTP_EXPIRY_MINUTES):
                    return Response(
                        {"error": "OTP has expired. Please request a new one."},
                        status=400,
                    )

            user.otp_verified = True
            user.is_verified = True
            user.save(update_fields=["otp_verified", "is_verified"])

            verification_token = _make_verification_token(user)
            return Response(
                {"message": "OTP verified", "verification_token": verification_token},
                status=200,
            )

        # ── Set Password ──────────────────────────────────────────────────────
        elif action == "set-password":
            token = request.data.get("verification_token")
            password = request.data.get("password")
            if not token or not password:
                return Response(
                    {"error": "verification_token and password are required"},
                    status=400,
                )

            user_id, ok, err = _decode_verification_token(token)
            if not ok:
                return Response({"error": err or "Invalid token"}, status=400)

            try:
                user = User.objects.get(id=user_id)
            except User.DoesNotExist:
                return Response({"error": "User not found"}, status=404)

            if not user.otp_verified:
                return Response(
                    {"error": "OTP not verified for this account"}, status=403
                )

            user.set_password(password)
            user.otp = None
            user.otp_created_at = None
            user.save(update_fields=["password", "otp", "otp_created_at"])
            return Response(
                {"message": "Password set successfully. You can now log in."},
                status=200,
            )

        # ── Forgot Password ───────────────────────────────────────────────────
        elif action == "forgot-password":
            email = request.data.get("email")
            if not email:
                return Response({"error": "Email is required"}, status=400)
            try:
                user = User.objects.get(email=email)
                user.otp = "123456"
                user.otp_created_at = timezone.now()
                user.otp_verified = False
                user.save(update_fields=["otp", "otp_created_at", "otp_verified"])
                logger.info(f"[OTP] Generated dummy reset OTP for {email}: 123456")
            except User.DoesNotExist:
                pass  # Don't reveal if user exists
            return Response(
                {"message": "If that email exists, a reset code was sent."}, status=200
            )

        # ── Reset Password ────────────────────────────────────────────────────
        elif action == "reset-password":
            email = request.data.get("email")
            otp = request.data.get("otp")
            new_password = request.data.get("new_password")
            if not all([email, otp, new_password]):
                return Response(
                    {"error": "email, otp, and new_password are required"}, status=400
                )

            try:
                user = User.objects.get(email=email)
            except User.DoesNotExist:
                return Response({"error": "User not found"}, status=404)

            if user.otp != otp:
                return Response({"error": "Invalid OTP"}, status=400)

            if user.otp_created_at:
                age = timezone.now() - user.otp_created_at
                if age > timedelta(minutes=OTP_EXPIRY_MINUTES):
                    return Response({"error": "OTP expired"}, status=400)

            user.set_password(new_password)
            user.otp = None
            user.otp_verified = False
            user.otp_created_at = None
            user.save(
                update_fields=["password", "otp", "otp_verified", "otp_created_at"]
            )
            return Response({"message": "Password reset successful."}, status=200)

        return Response({"error": "Unknown action"}, status=404)
