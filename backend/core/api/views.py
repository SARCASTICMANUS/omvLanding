from rest_framework import viewsets, status
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated, AllowAny
from django.contrib.gis.geos import Point, LineString
from django.contrib.auth import authenticate
from rest_framework_simplejwt.tokens import RefreshToken
from geopy.geocoders import Nominatim
from geopy.exc import GeocoderTimedOut, GeocoderUnavailable

from core.models import University, Route, Stop, Vehicle, StudentAssignment, ActiveTrip
from core.utils import create_route_geometry
from core.api.serializers import (
    UniversitySerializer,
    RouteSerializer,
    StopSerializer,
    VehicleSerializer,
    StudentAssignmentSerializer,
    RegisterSerializer,
    UserSerializer,
)

geolocator = Nominatim(user_agent="vayy_university_v1", timeout=10)


class UniversityViewSet(viewsets.ModelViewSet):
    permission_classes = [AllowAny]
    queryset = University.objects.all()
    serializer_class = UniversitySerializer


class VehicleViewSet(viewsets.ModelViewSet):
    queryset = Vehicle.objects.all()
    serializer_class = VehicleSerializer

    def get_queryset(self):
        # Filter by university if provided
        univ_id = self.request.query_params.get("university")
        if univ_id:
            return self.queryset.filter(university_id=univ_id)
        return self.queryset


class StudentAssignmentViewSet(viewsets.ModelViewSet):
    queryset = StudentAssignment.objects.all()
    serializer_class = StudentAssignmentSerializer


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
        custom_geometry = request.data.get(
            "path"
        )  # Option to pass selected alternative geometry

        if custom_geometry:
            # Frontend passes back the path from selected alternative [ [lat, lon], ... ]
            path_coords = [(lon, lat) for lat, lon in custom_geometry]
            path = LineString(path_coords, srid=4326)
            total_distance = request.data.get("total_distance", 0)
        else:
            # Default fallback logic (sequenced waypoints)
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
        )

        # Create Stops
        for idx, s in enumerate(stops_data):
            Stop.objects.create(
                route=route,
                name=s.get("name", f"Stop {idx+1}"),
                location=Point(float(s["lon"]), float(s["lat"])),
                order=idx,
            )

        return Response(RouteSerializer(route).data, status=201)

    def delete(self, request):
        route_id = request.query_params.get("id")
        Route.objects.filter(id=route_id).delete()
        return Response(status=204)


class AdminRoutePreviewView(APIView):
    def post(self, request):
        start = request.data.get("start")
        end = request.data.get("end")
        stops_data = request.data.get("stops", [])

        # Sequence: Start -> Stops -> End
        waypoints = [(start["lon"], start["lat"])]
        for s in sorted(stops_data, key=lambda x: x.get("order", 0)):
            waypoints.append((float(s["lon"]), float(s["lat"])))
        waypoints.append((end["lon"], end["lat"]))

        route_options = create_route_geometry(waypoints, alternatives=True)
        if not route_options:
            return Response({"error": "No routes found"}, status=404)

        # Format for frontend
        output = []
        for r in route_options:
            output.append(
                {
                    "path": [
                        [y, x] for x, y in r["geometry"].coords
                    ],  # [lat, lon] for Leaflet
                    "distance": r["total_distance"],
                    "duration": r["duration"],
                }
            )

        return Response(output)


class DriverStartTripView(APIView):
    def get(self, request):
        # Drivers see routes for their university
        user = request.user
        routes = Route.objects.all()
        if hasattr(user, "university") and user.university:
            routes = routes.filter(university=user.university)
        return Response(
            [
                {
                    "id": r.id,
                    "name": f"{r.name} ({r.start_name} -> {r.end_name})",
                    "total_distance": r.total_distance_meters,
                }
                for r in routes
            ]
        )

    def post(self, request):
        route_id = request.data.get("route_id")
        vehicle_id = request.data.get("vehicle_id")

        try:
            route = Route.objects.get(id=route_id)
            # Find or auto-assign vehicle if not provided
            if vehicle_id:
                vehicle = Vehicle.objects.get(id=vehicle_id)
            else:
                vehicle = Vehicle.objects.filter(driver=request.user).first()
        except (Route.DoesNotExist, Vehicle.DoesNotExist):
            return Response({"error": "Route or Vehicle not found"}, status=404)

        trip = ActiveTrip.objects.create(
            route=route, vehicle=vehicle, driver=request.user
        )
        return Response(
            {
                "trip_id": trip.id,
                "route_geometry": [[y, x] for x, y in route.path.coords],
                "total_distance": route.total_distance_meters,
                "stops": StopSerializer(route.stops.all(), many=True).data,
            }
        )


class PassengerMatchView(APIView):
    def post(self, request):
        lat = request.data.get("lat")
        lon = request.data.get("lon")
        p_point = Point(float(lon), float(lat), srid=4326)

        # Find routes within 10km (0.1 deg approx)
        routes = Route.objects.filter(path__dwithin=(p_point, 0.1))
        active_trips = ActiveTrip.objects.filter(route__in=routes, is_active=True)

        matches = []
        for trip in active_trips:
            matches.append(
                {
                    "trip_id": trip.id,
                    "vehicle_number": (
                        trip.vehicle.vehicle_number if trip.vehicle else "N/A"
                    ),
                    "route_name": trip.route.name,
                }
            )
        return Response(matches)


class NearbyStopsView(APIView):
    def get(self, request):
        lat = request.query_params.get("lat")
        lon = request.query_params.get("lon")
        radius = float(request.query_params.get("radius", 0.05))  # ~5km default

        if not lat or not lon:
            return Response({"error": "lat and lon are required"}, status=400)

        p_point = Point(float(lon), float(lat), srid=4326)

        # Filter stops by distance and university
        stops = Stop.objects.filter(location__dwithin=(p_point, radius))
        if hasattr(request.user, "university") and request.user.university:
            stops = stops.filter(route__university=request.user.university)

        serializer = StopSerializer(stops, many=True)
        return Response(serializer.data)


class AuthView(APIView):
    permission_classes = [AllowAny]

    def post(self, request, action):
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

        elif action == "login":
            email = request.data.get("email")
            password = request.data.get("password")
            user = authenticate(username=email, password=password)
            if user:
                refresh = RefreshToken.for_user(user)
                # Force 'admin' role for superusers to ensure frontend access
                user_role = "admin" if user.is_superuser else user.role

                return Response(
                    {
                        "refresh": str(refresh),
                        "access": str(refresh.access_token),
                        "role": user_role,
                        "university": user.university.id if user.university else None,
                        "name": f"{user.first_name} {user.last_name}",
                    }
                )
            return Response({"error": "Invalid Creds"}, status=401)

        elif action == "send-otp":
            email = request.data.get("email")
            # Logic for sending OTP (Placeholder for now)
            print(f"OTP Sent to: {email} (Code: 123456)")
            return Response({"message": "OTP sent to console"}, status=200)

        elif action == "verify-otp":
            otp = request.data.get("otp")
            # Logic for verifying OTP (Placeholder for now)
            if otp == "123456":
                return Response({"message": "OTP verified"}, status=200)
            return Response({"error": "Invalid OTP"}, status=400)

        return Response(status=404)
