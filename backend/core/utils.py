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


def create_route_geometry(waypoints, alternatives=False):
    """
    waypoints: List of (lon, lat) tuples in order: [start, stop1, ..., stopN, end]
    alternatives: Boolean to request alternative routes from OSRM
    """
    if not waypoints or len(waypoints) < 2:
        return None

    coords_str = ";".join([f"{lon},{lat}" for lon, lat in waypoints])
    alt_param = "true" if alternatives else "false"

    # Using OSRM 'route' service with waypoints
    url = f"{OSRM_HOST}/route/v1/driving/{coords_str}?overview=full&geometries=polyline&alternatives={alt_param}"

    try:
        response = requests.get(url, timeout=5)
        data = response.json()
        if data["code"] != "Ok":
            return None

        results = []
        for route_data in data["routes"]:
            decoded = polyline.decode(route_data["geometry"])
            # PostGIS needs (lon, lat)
            path_coords = [(lon, lat) for lat, lon in decoded]

            results.append(
                {
                    "geometry": LineString(path_coords, srid=4326),
                    "total_distance": route_data["distance"],
                    "duration": route_data["duration"],
                    "geometry_polyline": route_data[
                        "geometry"
                    ],  # Keep raw for frontend if needed
                }
            )

        return results if alternatives else results[0]
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
                "total_distance": route["distance"],  # meters
            }
    except Exception:
        return None
    return None
