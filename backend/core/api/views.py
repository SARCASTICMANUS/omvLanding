# VAYY | core/api/views.py | Status: 🔧 Fixed
# Reason: Real OTP flow (3-step), me endpoint, set-password, forgot/reset password,
#         one-active-trip constraint, next-3-stops student counts, bulk upload view.

import os
import secrets
import tempfile
from datetime import timedelta
import logging
from rest_framework import viewsets, status
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated, AllowAny
from rest_framework.parsers import MultiPartParser, FormParser, JSONParser
from django.contrib.gis.geos import Point, LineString
from django.contrib.auth import authenticate
from django.utils import timezone
from rest_framework_simplejwt.tokens import RefreshToken
from geopy.geocoders import Nominatim
from geopy.exc import GeocoderTimedOut, GeocoderUnavailable

from core.models import (
    University, Route, Stop, Vehicle, StudentAssignment,
    ActiveTrip, StudentProfile, DriverProfile, BulkUploadLog
)
from core.utils import create_route_geometry
from core.api.serializers import (
    UniversitySerializer,
    RouteSerializer,
    StopSerializer,
    VehicleSerializer,
    StudentAssignmentSerializer,
    RegisterSerializer,
    UserSerializer,
    ActiveTripSerializer,
    BulkUploadLogSerializer,
    DriverProfileSerializer,
    StudentProfileSerializer
)

geolocator = Nominatim(user_agent="vayy_university_v1", timeout=10)

OTP_EXPIRY_MINUTES = 10


# ─── Helper: make verification token ─────────────────────────────────────────
def _make_verification_token(user):
    """Creates a short-lived token to allow set-password after OTP verification."""
    import hmac, hashlib, time, base64
    payload = f"{user.id}:{int(time.time())}"
    secret = os.environ.get("SECRET_KEY", "vayy-dev-secret")
    sig = hmac.new(secret.encode(), payload.encode(), hashlib.sha256).hexdigest()
    raw = f"{payload}:{sig}"
    return base64.urlsafe_b64encode(raw.encode()).decode()


def _decode_verification_token(token, max_age_seconds=600):
    """Returns (user_id, ok, error)."""
    import hmac, hashlib, time, base64
    try:
        raw = base64.urlsafe_b64decode(token.encode()).decode()
        parts = raw.rsplit(":", 2)  # user_id:ts:sig
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

class UniversityViewSet(viewsets.ModelViewSet):
    permission_classes = [AllowAny]
    queryset = University.objects.all()
    serializer_class = UniversitySerializer


class VehicleViewSet(viewsets.ModelViewSet):
    queryset = Vehicle.objects.all()
    serializer_class = VehicleSerializer

    def get_queryset(self):
        univ_id = self.request.query_params.get("university")
        if univ_id:
            return self.queryset.filter(university_id=univ_id)
        return self.queryset


class StudentAssignmentViewSet(viewsets.ModelViewSet):
    queryset = StudentAssignment.objects.all()
    serializer_class = StudentAssignmentSerializer

    def get_queryset(self):
        vehicle_id = self.request.query_params.get("vehicle")
        if vehicle_id:
            return self.queryset.filter(vehicle_id=vehicle_id)
        return self.queryset


class DriverProfileViewSet(viewsets.ModelViewSet):
    queryset = DriverProfile.objects.all()
    serializer_class = DriverProfileSerializer

    def get_queryset(self):
        univ_id = self.request.query_params.get("university")
        if univ_id:
            return self.queryset.filter(user__university_id=univ_id)
        return self.queryset


class UserViewSet(viewsets.ModelViewSet):
    from django.contrib.auth import get_user_model
    User = get_user_model()
    queryset = User.objects.all()

    serializer_class = UserSerializer

    def get_queryset(self):
        univ_id = self.request.query_params.get("university")
        role = self.request.query_params.get("role")
        qs = self.queryset
        if univ_id:
            qs = qs.filter(university_id=univ_id)
        if role:
            qs = qs.filter(role=role)
        return qs


class StudentProfileViewSet(viewsets.ModelViewSet):
    queryset = StudentProfile.objects.all()
    serializer_class = StudentProfileSerializer

    def get_queryset(self):
        univ_id = self.request.query_params.get("university")
        if univ_id:
            return self.queryset.filter(user__university_id=univ_id)
        return self.queryset


# ─── Global Search ────────────────────────────────────────────────────────────

class GlobalSearchView(APIView):
    def get(self, request):
        query = request.query_params.get("q")
        if not query:
            return Response([])
        try:
            locations = geolocator.geocode(query, exactly_one=False, limit=5)
            results = []
            if locations:
                for loc in locations:
                    results.append(
                        {
                            "display_name": loc.address,
                            "lat": loc.latitude,
                            "lon": loc.longitude,
                        }
                    )
            return Response(results)
        except (GeocoderTimedOut, GeocoderUnavailable):
            return Response({"error": "Search service busy"}, status=503)
        except Exception:
            return Response([], status=200)


# ─── Route Management ─────────────────────────────────────────────────────────

class AdminRouteView(APIView):
    def get(self, request):
        univ_id = request.query_params.get("university")
        routes = Route.objects.all()
        if univ_id:
            routes = routes.filter(university_id=univ_id)
        serializer = RouteSerializer(routes, many=True)
        return Response(serializer.data)

    def post(self, request):
        start = request.data.get("start")
        end = request.data.get("end")
        univ_id = request.data.get("university")
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
            university_id=univ_id,
            path=path,
            total_distance_meters=total_distance,
            start_name=request.data.get("start_name", "Start"),
            end_name=request.data.get("end_name", "End"),
            name=request.data.get("name", "New Route"),
            bus_number=request.data.get("bus_number", ""),
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
        for field in ["name", "bus_number", "start_name", "end_name"]:
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
            output.append(
                {
                    "path": [[y, x] for x, y in r["geometry"].coords],
                    "distance": r["total_distance"],
                    "duration": r["duration"],
                }
            )
        return Response(output)


# ─── Driver Views ─────────────────────────────────────────────────────────────

class DriverStartTripView(APIView):
    def get(self, request):
        user = request.user
        routes = Route.objects.all()
        if hasattr(user, "university") and user.university:
            routes = routes.filter(university=user.university)
        return Response(
            [
                {
                    "id": r.id,
                    "name": f"{r.name} ({r.start_name} → {r.end_name})",
                    "total_distance": r.total_distance_meters,
                    "stops_count": r.stops.count(),
                    "bus_number": r.bus_number,
                }
                for r in routes
            ]
        )

    def post(self, request):
        route_id = request.data.get("route_id")
        vehicle_id = request.data.get("vehicle_id")

        # ── One-active-trip constraint (with auto-resume) ─────────────────────
        existing = ActiveTrip.objects.filter(
            driver=request.user, status="active"
        ).first()

        if existing:
            # If they already have a trip, just return it (Resume)
            return self._format_trip_response(existing)

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
        return self._format_trip_response(trip)

    def _format_trip_response(self, trip):
        return Response(
            {
                "trip_id": str(trip.id),
                "route_geometry": [[y, x] for x, y in trip.route.path.coords],
                "total_distance": trip.route.total_distance_meters,
                "stops": StopSerializer(trip.route.stops.all(), many=True).data,
                "bus_number": trip.route.bus_number,
                "resumed": True if trip.status == "active" else False # though it's always active here
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
    """Return waiting student counts for next 3 stops on the trip."""
    def get(self, request, trip_id):
        from django.contrib.gis.measure import D

        try:
            trip = ActiveTrip.objects.get(id=trip_id)
        except ActiveTrip.DoesNotExist:
            return Response({"error": "Trip not found"}, status=404)

        stops = list(trip.route.stops.order_by("order")[:3])

        result = []
        for stop in stops:
            # Count ACTIVE students (active in last 5 minutes) at this stop
            # 50 meters in degrees approx: 50 / 40000000.0 * 360
            deg_50m = 50 / 40000000.0 * 360
            active_cutoff = timezone.now() - timedelta(minutes=5)
            
            base_query = StudentProfile.objects.filter(
                pickup_stop__dwithin=(stop.location, deg_50m),
                last_active_at__gte=active_cutoff
            )

            if trip.vehicle:
                count = base_query.filter(
                    user__vehicle_assignments__vehicle=trip.vehicle,
                ).count()
            else:
                count = base_query.filter(
                    user__vehicle_assignments__vehicle__route=trip.route,
                ).count()
            result.append(
                {
                    "stop_id": str(stop.id),
                    "name": stop.name,
                    "lat": stop.location.y,
                    "lon": stop.location.x,
                    "order": stop.order,
                    "waiting_count": count,
                }
            )
        return Response(result)


# ─── Passenger / Student Views ────────────────────────────────────────────────

class PassengerMatchView(APIView):
    def post(self, request):
        lat = request.data.get("lat")
        lon = request.data.get("lon")
        p_point = Point(float(lon), float(lat), srid=4326)

        routes = Route.objects.filter(path__dwithin=(p_point, 0.1))
        cutoff = timezone.now() - timedelta(seconds=90)
        active_trips = ActiveTrip.objects.filter(
            route__in=routes, status="active", last_updated__gte=cutoff
        )

        matches = []
        for trip in active_trips:
            matches.append(
                {
                    "trip_id": trip.id,
                    "vehicle_number": (
                        trip.vehicle.vehicle_number if trip.vehicle else "N/A"
                    ),
                    "route_name": trip.route.name,
                    "bus_number": trip.route.bus_number,
                }
            )
        return Response(matches)


class NearbyStopsView(APIView):
    def get(self, request):
        lat = request.query_params.get("lat")
        lon = request.query_params.get("lon")
        radius = float(request.query_params.get("radius", 0.05))

        if not lat or not lon:
            return Response({"error": "lat and lon are required"}, status=400)

        p_point = Point(float(lon), float(lat), srid=4326)
        stops = Stop.objects.filter(location__dwithin=(p_point, radius))
        if hasattr(request.user, "university") and request.user.university:
            stops = stops.filter(route__university=request.user.university)

        serializer = StopSerializer(stops, many=True)
        return Response(serializer.data)

# ─── Student Dashboard ────────────────────────────────────────────────────────

class StudentDashboardView(APIView):
    def get(self, request):
        user = request.user
        cutoff = timezone.now() - timedelta(seconds=90)

        # Get assigned vehicle via StudentAssignment
        from core.models import StudentAssignment
        assignment = StudentAssignment.objects.filter(student=user).first()
        vehicle = assignment.vehicle if assignment else None
        assigned_route = vehicle.route if vehicle else None

        if not assigned_route:
            return Response(
                {
                    "has_route": False,
                    "message": "No vehicle/route assigned to your profile.",
                    "active_trips": [],
                    "boarding_eligible": False,
                }
            )

        profile = getattr(user, "student_profile", None)
        active_trips = ActiveTrip.objects.filter(
            route=assigned_route, status="active", last_updated__gte=cutoff
        )

        boarding_eligible = profile.boarding_eligible if profile else False

        trip_data = []
        for trip in active_trips:
            trip_data.append(
                {
                    "trip_id": str(trip.id),
                    "bus_number": trip.route.bus_number,
                    "route_name": trip.route.name,
                    "driver_name": trip.driver.get_full_name() if trip.driver else "",
                }
            )

        route_path = [[y, x] for x, y in assigned_route.path.coords]
        
        # Pickup stop is now optional/inherited in UI, but keep if set in profile
        pickup_lat = profile.pickup_stop.y if profile and profile.pickup_stop else None
        pickup_lon = profile.pickup_stop.x if profile and profile.pickup_stop else None

        return Response(
            {
                "has_route": True,
                "university_id": str(assigned_route.university_id),
                "is_bus_active": len(trip_data) > 0,
                "message": "" if len(trip_data) > 0 else "This bus is not currently active.",
                "assigned_route": {
                    "id": str(assigned_route.id),
                    "name": assigned_route.name,
                    "bus_number": assigned_route.bus_number,
                    "path_coords": route_path,
                },
                "assigned_vehicle": {
                    "vehicle_number": vehicle.vehicle_number,
                    "vehicle_type": vehicle.vehicle_type,
                } if vehicle else None,
                "pickup_stop": {"lat": pickup_lat, "lon": pickup_lon},
                "active_trips": trip_data,
                "boarding_eligible": boarding_eligible,
                "student_profile": {
                    "boarding_eligible": boarding_eligible,
                    "bus_pass_validity": profile.bus_pass_validity if profile else None,
                } if profile else None,
            }
        )


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
                        "university": str(user.university.id) if user.university else None,
                        "name": f"{user.first_name} {user.last_name}".strip() or user.email,
                        "email": user.email,
                    }
                )
            return Response({"error": "Invalid credentials"}, status=401)

        # ── Send OTP ──────────────────────────────────────────────────────────
        elif action == "send-otp":
            email = request.data.get("email")
            if not email:
                return Response({"error": "Email is required"}, status=400)

            # Check if user already exists
            user = User.objects.filter(email=email).first()
            if user:
                if user.otp_verified:
                    return Response({"error": "Email already registered and verified."}, status=400)
                # User exists but not verified, we can just resend the OTP.
            else:
                # Create a new unverified user
                user = User.objects.create(
                    email=email,
                    username=email,
                    role="student",
                    is_active=True,
                )
                user.set_unusable_password()
                user.save(update_fields=["password"])

            # Fire async OTP task
            from core.tasks import send_otp_async
            
            # Run synchronously so the print statement shows up in the runserver console
            send_otp_async(user.id)
            print(f"[DEV] Triggered OTP sent to {email}")

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

            # Check OTP validity
            if user.otp != otp:
                return Response({"error": "Invalid OTP"}, status=400)

            if user.otp_created_at:
                age = timezone.now() - user.otp_created_at
                if age > timedelta(minutes=OTP_EXPIRY_MINUTES):
                    return Response({"error": "OTP has expired. Please request a new one."}, status=400)

            # Mark verified
            user.otp_verified = True
            user.is_verified = True
            user.save(update_fields=["otp_verified", "is_verified"])

            # Return a short-lived verification token
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
                    {"error": "verification_token and password are required"}, status=400
                )

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
            # Clear OTP after use
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
                from core.tasks import send_otp_async
                try:
                    send_otp_async.delay(user.id)
                except Exception:
                    import random, string
                    otp = "".join(random.choices(string.digits, k=6))
                    user.otp = otp
                    user.otp_created_at = timezone.now()
                    user.otp_verified = False
                    user.save(update_fields=["otp", "otp_created_at", "otp_verified"])
                    print(f"[DEV] Password reset OTP for {email}: {otp}")
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


# ─── Bulk Upload View ─────────────────────────────────────────────────────────

class BulkUploadView(APIView):
    """
    POST /api/admin/students/bulk-upload/
    Accepts CSV or .xlsx. For >100 rows launches Celery task.
    """
    parser_classes = [MultiPartParser, FormParser]

    def post(self, request):
        file = request.FILES.get("file")
        if not file:
            return Response({"error": "No file uploaded"}, status=400)

        allowed_extensions = [".csv", ".xlsx"]
        ext = os.path.splitext(file.name)[1].lower()
        if ext not in allowed_extensions:
            return Response({"error": f"Unsupported file type. Allowed: {allowed_extensions}"}, status=400)

        # Save to temp file
        suffix = ext
        with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
            for chunk in file.chunks():
                tmp.write(chunk)
            tmp_path = tmp.name

        # Count rows to decide sync vs async
        try:
            if ext == ".xlsx":
                import openpyxl
                wb = openpyxl.load_workbook(tmp_path)
                row_count = wb.active.max_row - 1  # minus header
            else:
                import csv
                with open(tmp_path, "r", encoding="utf-8") as f:
                    row_count = sum(1 for _ in csv.reader(f)) - 1
        except Exception as e:
            os.remove(tmp_path)
            return Response({"error": f"Could not read file: {e}"}, status=400)

        log = BulkUploadLog.objects.create(
            uploaded_by=request.user,
            file_name=file.name,
            total_rows=row_count,
        )

        if row_count > 100:
            from core.tasks import process_bulk_upload
            task = process_bulk_upload.delay(log.id, tmp_path)
            return Response(
                {
                    "status": "processing",
                    "log_id": log.id,
                    "task_id": task.id,
                    "total_rows": row_count,
                    "message": f"Large file ({row_count} rows) — processing in background.",
                },
                status=202,
            )
        else:
            from core.tasks import process_bulk_upload
            process_bulk_upload(log.id, tmp_path)  # Synchronous for small files
            log.refresh_from_db()
            return Response(BulkUploadLogSerializer(log).data, status=200)
