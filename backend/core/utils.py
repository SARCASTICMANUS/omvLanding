import requests
import polyline
from django.contrib.gis.geos import LineString
import os

# If running local python, we need to hit localhost. If docker, hit 'osrm' container.
# However, for OSRM, the 'backend' container (if running via docker-compose) needs 'http://osrm:5000'
# If running python locally, use 'http://localhost:5000'
OSRM_HOST = (
    "http://osrm:5000" if os.environ.get("IN_DOCKER") else "http://localhost:5000"
)


def create_route_geometry(start_coords, end_coords):
    # start/end: (lon, lat) tuples
    url = f"{OSRM_HOST}/route/v1/driving/{start_coords[0]},{start_coords[1]};{end_coords[0]},{end_coords[1]}?overview=full&geometries=polyline"
    try:
        response = requests.get(url, timeout=2)
        data = response.json()
        if data["code"] != "Ok":
            return None

        route_data = data["routes"][0]
        decoded = polyline.decode(route_data["geometry"])
        # Polyline returns (lat, lon), PostGIS needs (lon, lat)
        path_coords = [(lon, lat) for lat, lon in decoded]

        return {
            "geometry": LineString(path_coords, srid=4326),
            "distance": route_data["distance"],
            "duration": route_data["duration"],
        }
    except Exception as e:
        print(f"OSRM Route Error: {e}")
        return None


def get_eta_osrm(driver_coords, passenger_coords):
    # Driver -> Passenger
    url = f"{OSRM_HOST}/route/v1/driving/{driver_coords[0]},{driver_coords[1]};{passenger_coords[0]},{passenger_coords[1]}?overview=false"
    try:
        response = requests.get(url, timeout=1)
        data = response.json()
        if data["code"] == "Ok":
            route = data["routes"][0]
            return {
                "duration": route["duration"],  # seconds
                "distance": route["distance"],  # meters
            }
    except Exception:
        return None
    return None
