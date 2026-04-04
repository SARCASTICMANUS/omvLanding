# VAYY | core/api/views.py | Status: ✅ Public Transport Refactor
# Converted from University/Student to City/Passenger/Driver model.

import os
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
from rest_framework_simplejwt.tokens import RefreshToken
from geopy.geocoders import Nominatim
from geopy.exc import GeocoderTimedOut, GeocoderUnavailable

from core.models import (
    City, Route, Stop, Vehicle,
    ActiveTrip, PublicPassengerProfile, PublicDriverProfile
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
)

logger = logging.getLogger(__name__)

OTP_EXPIRY_MINUTES = 10


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
        expected_sig = hmac.new(secret.encode(), payload.encode(), hashlib.sha256).hexdigest()
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


# ─── Global Location Search ───────────────────────────────────────────────────

class GlobalSearchView(APIView):
    permission_classes = [AllowAny]
    def get(self, request):
        query = request.query_params.get("q")
        if not query:
            return Response([])
        try:
            geolocator = Nominatim(user_agent="vayy-app")
            locations = geolocator.geocode(query, exactly_one=False, limit=5)
            results = []
            if locations:
                for loc in locations:
                    results.append({
                        "display_name": loc.address,
                        "lat": loc.latitude,
                        "lon": loc.longitude,
                    })
            return Response(results)
        except (GeocoderTimedOut, GeocoderUnavailable):
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
            geolocator = Nominatim(user_agent="vayy-app")
            location = geolocator.reverse(f"{lat}, {lon}")
            if location:
                return Response({
                    "display_name": location.address,
                    "lat": location.latitude,
                    "lon": location.longitude,
                })
            return Response({"error": "No location found"}, status=404)
        except (GeocoderTimedOut, GeocoderUnavailable):
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
        city_id = request.data.get("city")
        stops_data = request.data.get("stops", [])
        custom_geometry = request.data.get("path")

        if custom_geometry:
            path_coords = [(lon, lat) for lat, lon in custom_geometry]
            path = LineString(path_coords, srid=4326)
            total_distance = request.data.get("total_distance", 0)
        else:
            waypoints = [(start["lon"], start["lat"])]
            for s in stops_data:
                waypoints.append((float(s["lon"]), float(s["lat"])))
            waypoints.append((end["lon"], end["lat"]))

            route_data = create_route_geometry(waypoints)
            if not route_data:
                return Response({"error": "Could not calculate route"}, status=400)
            path = route_data["geometry"]
            total_distance = route_data["distance"]

        route = Route.objects.create(
            city_id=city_id or None,
            path=path,
            total_distance_meters=total_distance,
            start_name=request.data.get("start_name", "Start"),
            end_name=request.data.get("end_name", "End"),
            name=request.data.get("name", "New Route"),
            bus_number=request.data.get("bus_number", ""),
            is_public=request.data.get("is_public", True),
        )

        for idx, s in enumerate(stops_data):
            Stop.objects.create(
                route=route,
                name=s.get("name", f"Stop {idx+1}"),
                location=Point(float(s["lon"]), float(s["lat"])),
                order=idx,
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

        waypoints = [(start["lon"], start["lat"])]
        for s in sorted(stops_data, key=lambda x: x.get("order", 0)):
            waypoints.append((float(s["lon"]), float(s["lat"])))
        waypoints.append((end["lon"], end["lat"]))

        route_options = create_route_geometry(waypoints, alternatives=True)
        if not route_options:
            return Response({"error": "No routes found"}, status=404)

        output = []
        for r in route_options:
            output.append({
                "path": [[y, x] for x, y in r["geometry"].coords],
                "distance": r["total_distance"],
                "duration": r["duration"],
            })
        return Response(output)


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

        return Response([
            {
                "id": r.id,
                "name": f"{r.name} ({r.start_name} → {r.end_name})",
                "total_distance": r.total_distance_meters,
                "stops_count": r.stops.count(),
                "bus_number": r.bus_number,
                "city": str(r.city_id) if r.city_id else None,
            }
            for r in routes
        ])

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

        # Increment driver's total trips
        try:
            profile = request.user.driver_profile
            profile.total_trips += 1
            profile.save(update_fields=["total_trips"])
        except Exception:
            pass

        return self._format_trip_response(trip, resumed=False)

    def _format_trip_response(self, trip, *, resumed=False):
        return Response({
            "trip_id": str(trip.id),
            "route_geometry": [[y, x] for x, y in trip.route.path.coords],
            "total_distance": trip.route.total_distance_meters,
            "stops": StopSerializer(trip.route.stops.all(), many=True).data,
            "bus_number": trip.route.bus_number,
            "route_name": trip.route.name,
            "resumed": resumed,
        })


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

        stops = list(trip.route.stops.order_by("order")[:3])
        result = []
        for stop in stops:
            result.append({
                "stop_id": str(stop.id),
                "name": stop.name,
                "lat": stop.location.y,
                "lon": stop.location.x,
                "order": stop.order,
            })
        return Response(result)


# ─── Passenger Views ──────────────────────────────────────────────────────────

class PassengerMatchView(APIView):
    """Find active trips on routes near the passenger's location."""
    def post(self, request):
        lat = request.data.get("lat")
        lon = request.data.get("lon")
        radius_deg = float(request.data.get("radius", 0.1))  # ~11km
        p_point = Point(float(lon), float(lat), srid=4326)

        routes = Route.objects.filter(path__dwithin=(p_point, radius_deg), is_public=True)
        cutoff = timezone.now() - timedelta(seconds=90)
        active_trips = ActiveTrip.objects.filter(
            route__in=routes, status="active", last_updated__gte=cutoff
        ).select_related("route", "vehicle", "driver")

        matches = []
        for trip in active_trips:
            matches.append({
                "trip_id": str(trip.id),
                "vehicle_number": (trip.vehicle.vehicle_number if trip.vehicle else "N/A"),
                "route_name": trip.route.name,
                "bus_number": trip.route.bus_number,
                "driver_name": trip.driver.get_full_name() if trip.driver else "",
                "route_id": str(trip.route_id),
            })
        return Response(matches)


class PassengerNearbyStopsView(APIView):
    """Return stops near a given location — no city filter, open to all."""
    def get(self, request):
        lat = request.query_params.get("lat")
        lon = request.query_params.get("lon")
        radius = float(request.query_params.get("radius", 0.01))  # ~1.1km

        if not lat or not lon:
            return Response({"error": "lat and lon are required"}, status=400)

        p_point = Point(float(lon), float(lat), srid=4326)
        stops = Stop.objects.filter(
            location__dwithin=(p_point, radius),
            route__is_public=True,
        ).select_related("route")

        serializer = StopSerializer(stops, many=True)
        return Response(serializer.data)


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
            active_trips = active_trips.filter(
                route__path__dwithin=(p_point, radius)
            )

        trip_data = []
        for trip in active_trips:
            # Include basic stop info for distance calculation on frontend
            stops = trip.route.stops.order_by("order")[:3]
            trip_data.append({
                "trip_id": str(trip.id),
                "bus_number": trip.route.bus_number,
                "route_name": trip.route.name,
                "route_geometry": [[y, x] for x, y in trip.route.path.coords],
                "driver_name": trip.driver.get_full_name() if trip.driver else "",
                "vehicle_number": (trip.vehicle.vehicle_number if trip.vehicle else "N/A"),
                "stops": [
                    {"name": s.name, "lat": s.location.y, "lon": s.location.x}
                    for s in stops
                ]
            })

        return Response({
            "active_trips": trip_data,
            "total_active": len(trip_data),
        })


from core.utils import create_route_geometry, get_table_eta_async, _run
import redis
from django.db.models import F
from django.contrib.gis.db.models.functions import LineLocatePoint

# Redis setup (sync for view)
REDIS_HOST = "redis" if os.environ.get("IN_DOCKER") else "localhost"
r_client = redis.Redis(host=REDIS_HOST, port=6379, db=0)

class PassengerFilteredTripsView(APIView):
    """
    Filter active trips based on pickup and destination.
    Returns trips whose route passes near BOTH points,
    where pickup comes BEFORE destination on the route,
    and the vehicle hasn't passed the pickup point yet.
    """
    def post(self, request):
        pickup = request.data.get("pickup") # {lat, lon}
        destination = request.data.get("destination") # {lat, lon}
        print(f"PassengerFilteredTrips: Received request with pickup={pickup} and destination={destination}")
        
        if not pickup or not destination:
            return Response({"error": "Pickup and destination are required"}, status=400)

        p_point = Point(float(pickup["lon"]), float(pickup["lat"]), srid=4326)
        d_point = Point(float(destination["lon"]), float(destination["lat"]), srid=4326)
        
        # 1. Find routes that pass near both points AND have correct directionality
        # Radius in meters for geography queries
        radius_m = float(request.data.get("radius_m", 3000))
        
        # We annotate each route with the fraction of the line where pickup and destination are closest
        # Use filter with geography=True for accurate meter distance
        routes = Route.objects.filter(
            path__dwithin=(p_point, radius_m)
        ).filter(
            path__dwithin=(d_point, radius_m)
        ).annotate(
            p_frac=LineLocatePoint("path", p_point),
            d_frac=LineLocatePoint("path", d_point)
        ).filter(p_frac__lt=F("d_frac"))
        print(f"PassengerFilteredTrips: Found {routes.count()} candidate routes near pickup and destination with correct directionality")

        if not routes.exists():
            return Response([])

        # 2. Find active trips for these routes
        # Increased cutoff to 5 minutes (300s) to be less aggressive with staleness
        cutoff = timezone.now() - timedelta(seconds=300)
        active_trips = ActiveTrip.objects.filter(
            route__in=routes,
            status="active",
            last_updated__gte=cutoff
        ).select_related("route", "vehicle", "driver")
        print(f"PassengerFilteredTrips: Found {active_trips.count()} active trips for {routes.count()} candidate routes near pickup ({pickup['lat']}, {pickup['lon']}) and destination ({destination['lat']}, {destination['lon']}) within radius {radius_m}")

        results = []
        # Cache route fracs for quick lookup
        route_data_map = {r.id: r.p_frac for r in routes}

        for trip in active_trips:
            # Get current location from Redis (realtime) or DB
            curr_loc_raw = r_client.get(f"driver_pos:{trip.id}")
            if curr_loc_raw:
                lon, lat = map(float, curr_loc_raw.decode().split(","))
                curr_pos = (lon, lat)
            elif trip.current_location:
                curr_pos = (trip.current_location.x, trip.current_location.y)
            else:
                curr_pos = (trip.route.path.coords[0][0], trip.route.path.coords[0][1])

            # 3. DIRECTIONAL CHECK: Has the bus already passed the pickup?
            # We calculate current position fraction on the route path
            # Using a raw SQL query or another annotation for the specific point is best
            # But we can approximate by checking if the bus is near the pickup or before it.
            # For high accuracy, we'll do one more check:
            c_point = Point(curr_pos[0], curr_pos[1], srid=4326)
            
            # We'll use a simple QuerySet to get the fraction for the current point
            curr_frac_data = Route.objects.filter(id=trip.route_id).annotate(
                c_frac=LineLocatePoint("path", c_point)
            ).values("c_frac").first()
            
            curr_frac = curr_frac_data["c_frac"] if curr_frac_data else 0
            pickup_frac = route_data_map.get(trip.route_id, 0)

            # If bus has already passed the pickup point (with a buffer for GPS jitter/large routes)
            if curr_frac > (pickup_frac + 0.01):
                continue

            # 4. Find next stop and ETA
            stops = list(trip.route.stops.order_by("order"))
            next_stop = None
            eta_seconds = 0
            
            if stops:
                sources = [curr_pos]
                destinations = [(s.location.x, s.location.y) for s in stops]
                
                table = _run(get_table_eta_async(sources, destinations))
                if table and table.get("durations"):
                    durations = table["durations"][0]
                    # We want the first stop where stop_frac > curr_frac
                    # Or simply the one with the smallest duration that is ahead
                    # For now, pick the nearest stop as "next stop"
                    min_dur = min(durations)
                    idx = durations.index(min_dur)
                    next_stop = stops[idx]
                    eta_seconds = min_dur
            
            results.append({
                "trip_id": str(trip.id),
                "bus_number": trip.route.bus_number,
                "vehicle_number": trip.vehicle.vehicle_number if trip.vehicle else "N/A",
                "route_name": trip.route.name,
                "next_stop": next_stop.name if next_stop else "N/A",
                "eta_seconds": eta_seconds,
                "current_lat": curr_pos[1],
                "current_lon": curr_pos[0],
            })

        return Response(results)

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
                return Response({
                    "refresh": str(refresh),
                    "access": str(refresh.access_token),
                    "user": {"email": user.email, "role": user.role},
                })
            return Response(serializer.errors, status=400)

        # ── Login ─────────────────────────────────────────────────────────────
        elif action == "login":
            email = request.data.get("email")
            password = request.data.get("password")
            user = authenticate(username=email, password=password)
            if user:
                refresh = RefreshToken.for_user(user)
                user_role = "admin" if user.is_superuser else user.role
                return Response({
                    "refresh": str(refresh),
                    "access": str(refresh.access_token),
                    "role": user_role,
                    "city": str(user.city_id) if user.city_id else None,
                    "name": f"{user.first_name} {user.last_name}".strip() or user.email,
                    "email": user.email,
                })
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
                    return Response({"error": "OTP has expired. Please request a new one."}, status=400)

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
                return Response({"error": "verification_token and password are required"}, status=400)

            user_id, ok, err = _decode_verification_token(token)
            if not ok:
                return Response({"error": err or "Invalid token"}, status=400)

            try:
                user = User.objects.get(id=user_id)
            except User.DoesNotExist:
                return Response({"error": "User not found"}, status=404)

            if not user.otp_verified:
                return Response({"error": "OTP not verified for this account"}, status=403)

            user.set_password(password)
            user.otp = None
            user.otp_created_at = None
            user.save(update_fields=["password", "otp", "otp_created_at"])
            return Response({"message": "Password set successfully. You can now log in."}, status=200)

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
            return Response({"message": "If that email exists, a reset code was sent."}, status=200)

        # ── Reset Password ────────────────────────────────────────────────────
        elif action == "reset-password":
            email = request.data.get("email")
            otp = request.data.get("otp")
            new_password = request.data.get("new_password")
            if not all([email, otp, new_password]):
                return Response({"error": "email, otp, and new_password are required"}, status=400)

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
            user.save(update_fields=["password", "otp", "otp_verified", "otp_created_at"])
            return Response({"message": "Password reset successful."}, status=200)

        return Response({"error": "Unknown action"}, status=404)
