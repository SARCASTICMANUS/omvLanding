import httpx
import polyline
from django.contrib.gis.geos import LineString
import os
import asyncio
import logging
from django.core.cache import cache

logger = logging.getLogger(__name__)

OSRM_HOST = (
    "http://osrm:5000" if os.environ.get("IN_DOCKER") else "http://localhost:5000"
)


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
    alt_param  = "true" if alternatives else "false"
    url = f"/route/v1/driving/{coords_str}?overview=full&geometries=polyline&alternatives={alt_param}"

    async with _get_osrm_client() as client:
        try:
            response = await client.get(url)
            data = response.json()
            if data.get("code") != "Ok":
                return None

            results = []
            for route_data in data["routes"]:
                decoded     = polyline.decode(route_data["geometry"])
                path_coords = [(lon, lat) for lat, lon in decoded]
                results.append({
                    "geometry":          LineString(path_coords, srid=4326),
                    "total_distance":    route_data["distance"],
                    "duration":          route_data["duration"],
                    "geometry_polyline": route_data["geometry"],
                })
            return results if alternatives else results[0]
        except Exception as e:
            logger.error(f"OSRM Route Error: {e}")
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
                res = {"duration": route["duration"], "total_distance": route["distance"]}
                cache.set(cache_key, res, 10)
                return res
        except Exception as e:
            logger.error(f"OSRM ETA Error: {e}")
    return None


async def get_table_eta_async(sources, destinations):
    """
    OSRM Table API: compute a duration/distance matrix between
    multiple sources and destinations in one request.
    sources / destinations: list of (lon, lat) tuples.
    """
    all_coords   = sources + destinations
    coords_str   = ";".join(f"{lon},{lat}" for lon, lat in all_coords)
    src_indices  = ";".join(str(i) for i in range(len(sources)))
    dst_indices  = ";".join(str(i) for i in range(len(sources), len(all_coords)))
    url = (
        f"/table/v1/driving/{coords_str}"
        f"?sources={src_indices}&destinations={dst_indices}"
        f"&annotations=duration,distance"
    )

    async with _get_osrm_client() as client:
        try:
            response = await client.get(url)
            data = response.json()
            if data.get("code") == "Ok":
                return {
                    "durations": data.get("durations"),
                    "distances": data.get("distances"),
                }
        except Exception as e:
            logger.error(f"OSRM Table Error: {e}")
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
