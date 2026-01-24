from rest_framework.views import APIView
from rest_framework.response import Response
from geopy.geocoders import Nominatim
from django.contrib.gis.measure import D
from django.contrib.gis.geos import Point
from core.models import Route, ActiveTrip
from core.utils import create_route_geometry

# Cache geolocator to avoid instantiating repeatedly
# geolocator = Nominatim(user_agent="vayy_app")


# class GlobalSearchView(APIView):
#     def get(self, request):
#         query = request.query_params.get("q")
#         if not query:
#             return Response([])

#         locations = geolocator.geocode(query, exactly_one=False, limit=5)
#         results = []
#         if locations:
#             for loc in locations:
#                 results.append(
#                     {
#                         "display_name": loc.address,
#                         "lat": loc.latitude,
#                         "lon": loc.longitude,
#                     }
#                 )
#         return Response(results)

# FIX: Increase timeout to 10 seconds (OSM is slow)
geolocator = Nominatim(user_agent="vayy_app_v1", timeout=10)


class GlobalSearchView(APIView):
    def get(self, request):
        query = request.query_params.get("q")
        if not query:
            return Response([])

        try:
            # Perform the search
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

        except (GeocoderTimedOut, GeocoderUnavailable) as e:
            # Return empty list or error message instead of crashing
            print(f"Geopy Error: {e}")
            return Response({"error": "Search service busy, try again."}, status=503)
        except Exception as e:
            print(f"General Error: {e}")
            return Response([], status=200)


# class DriverStartTripView(APIView):
#     def post(self, request):
#         # Driver sends Start (A) and End (G)
#         start = request.data.get("start")  # {lat, lon}
#         end = request.data.get("end")
#         vehicle_type = request.data.get("vehicle_type")

#         # 1. Calculate Path via OSRM
#         route_data = create_route_geometry(
#             (start["lon"], start["lat"]), (end["lon"], end["lat"])
#         )

#         # 2. Save Route to DB
#         route = Route.objects.create(
#             path=route_data["geometry"],
#             total_distance_meters=route_data["distance"],
#             start_name=request.data.get("start_name", "Start"),
#             end_name=request.data.get("end_name", "End"),
#         )

#         # 3. Create Session
#         trip = ActiveTrip.objects.create(route=route, vehicle_type=vehicle_type)

#         return Response({"trip_id": trip.id, "route_geometry": route.path.coords})


class PassengerMatchView(APIView):
    def post(self, request):
        # Passenger sends their location (C) and destination (D)
        lat = request.data.get("lat")
        lon = request.data.get("lon")
        p_point = Point(float(lon), float(lat), srid=4326)

        # 1. Find routes within 10 meters of passenger
        # Use PostGIS DWithin on Geography type for accurate meters
        routes = Route.objects.filter(path__dwithin=(p_point, 10000))

        active_trips = ActiveTrip.objects.filter(route__in=routes, is_active=True)

        matches = []
        for trip in active_trips:
            matches.append(
                {
                    "trip_id": trip.id,
                    "vehicle_type": trip.vehicle_type,
                    "start": trip.route.start_name,
                    "end": trip.route.end_name,
                }
            )

        return Response(matches)


from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from django.contrib.gis.geos import Point
from core.models import Route, ActiveTrip
from core.utils import create_route_geometry


# --- 1. ADMIN: Route Management (CRUD) ---
class AdminRouteView(APIView):
    def get(self, request):
        """List all saved routes"""
        routes = Route.objects.all().order_by("-created_at")
        data = []
        for r in routes:
            data.append(
                {
                    "id": str(r.id),
                    "name": f"{r.start_name} to {r.end_name}",
                    "start_name": r.start_name,
                    "end_name": r.end_name,
                    "distance_km": round(r.total_distance_meters / 1000, 2),
                    # Convert LineString to simple array for frontend preview
                    "path": [[y, x] for x, y in r.path.coords],
                }
            )
        return Response(data)

    def post(self, request):
        """Create a new fixed route via OSRM"""
        start = request.data.get("start")  # {lat, lon}
        end = request.data.get("end")  # {lat, lon}
        s_name = request.data.get("start_name")
        e_name = request.data.get("end_name")

        # Calculate path using existing Utils
        route_data = create_route_geometry(
            (start["lon"], start["lat"]), (end["lon"], end["lat"])
        )

        if not route_data:
            return Response({"error": "Could not calculate route"}, status=400)

        route = Route.objects.create(
            path=route_data["geometry"],
            total_distance_meters=route_data["distance"],
            start_name=s_name,
            end_name=e_name,
        )
        return Response({"id": route.id, "message": "Route Saved"}, status=201)

    def delete(self, request):
        """Delete a route"""
        route_id = request.query_params.get("id")
        Route.objects.filter(id=route_id).delete()
        return Response(status=204)


# --- 2. DRIVER: Start Trip on Existing Route ---
class DriverStartTripView(APIView):
    def get(self, request):
        """Driver needs to see list of active routes to choose from"""
        routes = Route.objects.all()
        data = [{"id": r.id, "name": f"{r.start_name} -> {r.end_name}"} for r in routes]
        return Response(data)

    def post(self, request):
        """Start driving on a specific PRE-DEFINED route"""
        route_id = request.data.get("route_id")
        vehicle_type = request.data.get("vehicle_type", "bus")

        try:
            route = Route.objects.get(id=route_id)
        except Route.DoesNotExist:
            return Response({"error": "Route not found"}, status=404)

        # Create Active Session
        trip = ActiveTrip.objects.create(route=route, vehicle_type=vehicle_type)

        # Return the path so the driver app can render it
        # Convert (lon, lat) -> (lat, lon) for Leaflet
        path_coords = [[y, x] for x, y in route.path.coords]

        return Response(
            {
                "trip_id": trip.id,
                "route_geometry": path_coords,
                "total_distance": route.total_distance_meters,
            }
        )
