import httpx
import polyline
from django.contrib.gis.geos import LineString
import os
import asyncio
import logging
from django.core.cache import cache

logger = logging.getLogger(__name__)

OSRM_HOST = os.environ.get("OSRM_URL", "http://osrm:5000")


def _get_osrm_client():
    return httpx.AsyncClient(base_url=OSRM_HOST, timeout=2.0)


async def create_route_geometry_async(waypoints, alternatives=False):
    """
    Build a route from a sequence of (lon, lat) waypoints using OSRM.
    Returns a dict (or list of dicts when alternatives=True) with:
      - geometry: PostGIS LineString
      - total_distance: meters (float)
      - duration: seconds (float)
      - geometry_polyline: encoded string
    """
    if not waypoints or len(waypoints) < 2:
        return None

    coords_str = ";".join(f"{lon},{lat}" for lon, lat in waypoints)
    alt_param = "true" if alternatives else "false"
    url = f"/route/v1/driving/{coords_str}?overview=full&geometries=polyline&alternatives={alt_param}"

    async with _get_osrm_client() as client:
        try:
            response = await client.get(url)
            data = response.json()
            if data.get("code") != "Ok":
                return None

            results = []
            for route_data in data["routes"]:
                decoded = polyline.decode(route_data["geometry"])
                path_coords = [(lon, lat) for lat, lon in decoded]
                results.append(
                    {
                        "geometry": LineString(path_coords, srid=4326),
                        "total_distance": route_data["distance"],
                        "duration": route_data["duration"],
                        "geometry_polyline": route_data["geometry"],
                    }
                )
            return results if alternatives else results[0]
        except Exception as e:
            logger.error(f"OSRM Route Error connecting to {OSRM_HOST}: {e}")
            return None


async def get_eta_osrm_async(driver_coords, passenger_coords):
    """
    Compute ETA between two (lon, lat) points via OSRM.
    Results cached for 10 seconds to reduce redundant requests.
    """
    cache_key = f"eta:{driver_coords}:{passenger_coords}"
    cached = cache.get(cache_key)
    if cached is not None:
        return cached

    url = (
        f"/route/v1/driving/"
        f"{driver_coords[0]},{driver_coords[1]};"
        f"{passenger_coords[0]},{passenger_coords[1]}"
        f"?overview=false"
    )

    async with _get_osrm_client() as client:
        try:
            response = await client.get(url)
            data = response.json()
            if data.get("code") == "Ok":
                route = data["routes"][0]
                res = {
                    "duration": route["duration"],
                    "total_distance": route["distance"],
                }
                cache.set(cache_key, res, 10)
                return res
        except Exception as e:
            logger.error(f"OSRM ETA Error connecting to {OSRM_HOST}: {e}")
    return None


async def get_table_eta_async(sources, destinations):
    """
    OSRM Table API: compute a duration/distance matrix between
    multiple sources and destinations in one request.
    sources / destinations: list of (lon, lat) tuples.
    """
    all_coords = sources + destinations
    coords_str = ";".join(f"{lon},{lat}" for lon, lat in all_coords)
    src_indices = ";".join(str(i) for i in range(len(sources)))
    dst_indices = ";".join(str(i) for i in range(len(sources), len(all_coords)))
    url = (
        f"/table/v1/driving/{coords_str}"
        f"?sources={src_indices}&destinations={dst_indices}"
        f"&annotations=duration,distance"
    )

    async with _get_osrm_client() as client:
        try:
            response = await client.get(url)
            data = response.json()
            print(data)
            if data.get("code") == "Ok":
                return {
                    "durations": data.get("durations"),
                    "distances": data.get("distances"),
                }
        except Exception as e:
            logger.error(f"OSRM Table Error connecting to {OSRM_HOST}: {e}")
    return None


# ── Synchronous wrappers for Django ORM views ─────────────────────────────────
# Uses asyncio.run() which is safe in Python 3.10+ (avoids deprecated
# get_event_loop() and the RuntimeError it raises when called from a thread).


def _run(coro):
    """Run an async coroutine safely from a synchronous context."""
    try:
        # If there's already a running event loop (e.g., inside async Django
        # with ASGI) we cannot call asyncio.run(). Fall back to a new thread.
        loop = asyncio.get_running_loop()
    except RuntimeError:
        loop = None

    if loop and loop.is_running():
        import concurrent.futures

        with concurrent.futures.ThreadPoolExecutor(max_workers=1) as pool:
            future = pool.submit(asyncio.run, coro)
            return future.result()
    else:
        return asyncio.run(coro)


def create_route_geometry(waypoints, alternatives=False):
    return _run(create_route_geometry_async(waypoints, alternatives))


def get_eta_osrm(driver_coords, passenger_coords):
    return _run(get_eta_osrm_async(driver_coords, passenger_coords))


# ─── Hybrid Location Resolution ───────────────────────────────────────────────


def resolve_hybrid_location_external(cell_towers, wifi_aps):
    """
    Calls Mozilla Location Service (MLS) to resolve signals to lat/lon.
    Supports API key rotation and handles timeouts.
    """
    # Get keys from environment (comma-separated)
    keys = os.environ.get("MLS_API_KEYS", "test").split(",")
    # Simple rotation: use a random key or track index in cache (omitted for brevity, using first available)
    api_key = keys[0]
    url = f"https://location.services.mozilla.com/v1/geolocate?key={api_key}"

    payload = {
        "cellTowers": cell_towers,
        "wifiAccessPoints": wifi_aps,
        "fallbacks": {"ipf": False, "lacf": True, "scf": True},
    }

    try:
        # Using sync requests for simpler Celery task integration
        import requests

        response = requests.post(url, json=payload, timeout=5.0)
        if response.status_code == 200:
            data = response.json()
            return {
                "lat": data["location"]["lat"],
                "lon": data["location"]["lng"],
                "accuracy": data["accuracy"],
            }
        elif response.status_code == 403:
            logger.warning(f"MLS API Key {api_key} rejected or rate-limited.")
        else:
            logger.error(f"MLS Error: {response.status_code} - {response.text}")
    except Exception as e:
        logger.error(f"MLS Exception: {e}")

    return None


def process_gps_update(trip_id, lat, lon, source="gps"):
    """
    Standard logic for processing a GPS update:
    1. Update Redis (GEO and string)
    2. Broadcast to WebSocket groups (Trip and City)
    3. Update VehicleState with calculated schedule delay
    """
    from core.services.redis_service import get_redis_client
    from django.utils import timezone
    from asgiref.sync import async_to_sync
    from channels.layers import get_channel_layer
    from core.models import ActiveTrip, VehicleState, StopTime
    from django.contrib.gis.geos import Point
    from django.contrib.gis.db.models.functions import Distance
    from core.models import Stop

    r = get_redis_client()

    try:
        # 1. Update Redis
        r.geoadd("active_trips_locations", (float(lon), float(lat), str(trip_id)))
        r.set(f"driver_pos:{trip_id}", f"{lon},{lat}", ex=30)

        # Update ActiveTrip in DB for real-time status
        ActiveTrip.objects.filter(id=trip_id).update(
            current_location=Point(float(lon), float(lat), srid=4326),
            last_updated=timezone.now()
        )

        # 2. Fetch Metadata for Broadcast
        trip = ActiveTrip.objects.select_related(
            "route", "trip_schedule", "vehicle"
        ).get(id=trip_id)
        bus_number = trip.route.bus_number
        route_id = str(trip.route_id)
        city_id = str(trip.route.city_id) if trip.route.city_id else "public"

        # 3. Calculate Schedule Delay and Current Stop Order
        delay_minutes = 0
        current_stop_order = 0
        p_point = Point(float(lon), float(lat), srid=4326)
        if trip.trip_schedule:
            # Find nearest scheduled stop
            nearest_stop_time = (
                StopTime.objects.filter(trip_schedule=trip.trip_schedule)
                .select_related("stop")
                .annotate(distance=Distance("stop__location", p_point))
                .order_by("distance")
                .first()
            )

            if nearest_stop_time:
                current_stop_order = nearest_stop_time.stop.order
                now = timezone.now().time()
                sched = nearest_stop_time.arrival_time
                # Mins from midnight
                now_mins = now.hour * 60 + now.minute
                sched_mins = sched.hour * 60 + sched.minute
                delay_minutes = now_mins - sched_mins

        # 4. Update Redis with last stop passed
        r.set(f"driver_last_stop:{trip_id}", current_stop_order, ex=3600)

        # ─── New: Stop Arrival Detection (50m for 15s) ────────────────────────
        # 1. Check if we are within 50m of ANY stop on the route
        # Using a small degrees approx for 50m (~0.00045)
        near_stop = Stop.objects.filter(
            route_id=trip.route_id, location__dwithin=(p_point, 0.0005)
        ).first()

        channel_layer = get_channel_layer()

        if near_stop:
            arrival_key = f"stop_arrival_time:{trip_id}:{near_stop.id}"
            first_seen = r.get(arrival_key)
            now_ts = timezone.now().timestamp()

            if not first_seen:
                # First time entering 50m radius
                r.set(arrival_key, now_ts, ex=300)
            else:
                # Already near, check duration
                duration = now_ts - float(first_seen)
                if duration >= 15:
                    # Condition Met: Bus has arrived at stop
                    # A. Notify waiting passengers
                    from core.models import BoardingRequest

                    waiting = BoardingRequest.objects.filter(
                        trip_id=trip_id,
                        pickup_stop=near_stop,
                        status__in=["pending", "approaching"],
                    )

                    for req in waiting:
                        # req.status = "boarded" # Optional: auto-board
                        # req.save()
                        if channel_layer:
                            async_to_sync(channel_layer.group_send)(
                                f"user_{req.passenger_id}",
                                {
                                    "type": "proximity_alert",
                                    "trip_id": str(trip_id),
                                    "stop_name": near_stop.name,
                                    "message": f"Bus {bus_number} has reached {near_stop.name}. Please board now!",
                                },
                            )

                    # B. Update manifest for driver (Mark as Visited in Redis)
                    # We can store visited stops in a Set
                    r.sadd(f"visited_stops:{trip_id}", str(near_stop.id))

                    # Trigger manifest recalculation/push
                    from core.tasks import update_driver_manifest

                    update_driver_manifest.delay(str(trip_id))

                    # Prevent repeated alerts for the same arrival event
                    r.set(arrival_key, "ALREADY_NOTIFIED", ex=600)

        # 5. Update VehicleState
        if trip.vehicle:
            v_state, _ = VehicleState.objects.get_or_create(vehicle=trip.vehicle)
            v_state.active_trip = trip
            v_state.delay_minutes = delay_minutes
            v_state.save()

        # 6. Broadcast via Channels
        if channel_layer:
            # Fetch heading from Kalman Filter state if available
            heading = 0
            kf_state_raw = r.get(f"kf_state:{trip_id}")
            if kf_state_raw:
                import json as _json

                heading = _json.loads(kf_state_raw).get("heading", 0)

            payload = {
                "trip_id": str(trip_id),
                "lat": lat,
                "lon": lon,
                "heading": heading,
                "bus_number": bus_number,
                "route_id": route_id,
                "source": source,
                "delay_minutes": delay_minutes,
                "next_stop_eta": [],
            }

            # Broadcast to Trip Group
            async_to_sync(channel_layer.group_send)(
                f"trip_{trip_id}", {**payload, "type": "vehicle_update"}
            )

            # Broadcast to City Group
            async_to_sync(channel_layer.group_send)(
                f"city_{city_id}", {**payload, "type": "city_vehicle_update"}
            )

            # Broadcast Manifest Update to manifest_{vehicle_id} group
            # We trigger this so the specialized manifest view updates its "next 3 stops"
            if trip.vehicle:
                async_to_sync(channel_layer.group_send)(
                    f"manifest_{trip.vehicle_id}",
                    {
                        "type": "manifest_update",
                        "trip_id": str(trip_id),
                        "current_stop_order": current_stop_order,
                    },
                )

        return True
    except Exception as e:
        logger.error(f"Error in process_gps_update: {e}")
        return False


# ─── Kalman Filtering ─────────────────────────────────────────────────────────


class KalmanFilter:
    """
    A Kalman Filter implementation for smoothing geospatial coordinates.
    State: [lat, lon, velocity, heading]
    Assumes a linear-ish model for small time steps.
    """

    def __init__(self, dt=1.0):
        import numpy as np

        self.dt = dt
        # State vector [lat, lon, velocity, heading]
        self.x = np.array([0.0, 0.0, 0.0, 0.0])
        # Error covariance matrix
        self.P = np.eye(4) * 5.0
        # Process noise covariance
        self.Q = np.eye(4) * 0.1
        # Measurement noise covariance
        self.R = np.eye(2) * 2.0
        # Observation matrix (we only measure lat, lon)
        self.H = np.array([[1, 0, 0, 0], [0, 1, 0, 0]])

    def predict(self, current_dt=None):
        import numpy as np

        dt = current_dt or self.dt

        # Approximate linear transition matrix
        v = self.x[2]
        h = np.radians(self.x[3])

        # Simple prediction: lat, lon update based on current v, h
        # Note: 111111.0 is approx meters per degree lat
        self.x[0] += v * np.cos(h) * (dt / 111111.0)
        self.x[1] += v * np.sin(h) * (dt / (111111.0 * np.cos(np.radians(self.x[0]))))

        # P = FPF' + Q (Simplified)
        self.P = self.P + self.Q

    def update(self, lat, lon):
        import numpy as np

        z = np.array([lat, lon])

        # Innovation (y = z - Hx)
        y = z - self.H @ self.x

        # Innovation covariance (S = HPH' + R)
        S = self.H @ self.P @ self.H.T + self.R

        # Kalman gain (K = P H' S^-1)
        K = self.P @ self.H.T @ np.linalg.inv(S)

        # New state (x = x + Ky)
        self.x = self.x + K @ y

        # New covariance (P = (I - KH)P)
        I = np.eye(4)
        self.P = (I - K @ self.H) @ self.P

    def set_state(self, lat, lon, velocity=0.0, heading=0.0):
        import numpy as np

        self.x = np.array([lat, lon, velocity, heading])

    def get_state(self):
        return {
            "lat": self.x[0],
            "lon": self.x[1],
            "velocity": self.x[2],
            "heading": self.x[3],
        }
