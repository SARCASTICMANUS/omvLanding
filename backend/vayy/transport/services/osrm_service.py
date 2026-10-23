import requests
import logging
import hashlib
from typing import List, Tuple, Optional, Dict, Any, Union
from django.conf import settings
from django.core.cache import cache

logger = logging.getLogger(__name__)


class OSRMService:
    """
    Service wrapper for OSRM HTTP API (osrm-routed).
    Base URL points to the OSRM Docker container at http://osrm:5000.
    Supports: route, table, nearest, match, trip, tile services.
    """

    BASE_URL = getattr(settings, "OSRM_URL", "http://osrm:5000")
    DEFAULT_PROFILE = "driving"
    WALKING_PROFILE = getattr(settings, "OSRM_WALKING_PROFILE", "")
    WALKING_SPEED_MPS = 1.33
    CACHE_TTL = getattr(settings, "OSRM_CACHE_TTL", 600)

    @classmethod
    def _coord_str(cls, coords: List[Tuple[float, float]]) -> str:
        return ";".join([f"{c[0]},{c[1]}" for c in coords])

    @classmethod
    def _get(
        cls,
        path: str,
        params: Optional[Dict[str, Any]] = None,
        timeout: int = 10,
    ) -> Optional[Dict[str, Any]]:
        url = f"{cls.BASE_URL}{path}"
        try:
            response = requests.get(url, params=params, timeout=timeout)
            response.raise_for_status()
            return response.json()
        except requests.RequestException as e:
            logger.error(f"OSRM request failed [{url}]: {e}")
            return None

    @classmethod
    def route(
        cls,
        *coords: Tuple[float, float],
        profile: str = DEFAULT_PROFILE,
        alternatives: Union[bool, int] = False,
        steps: bool = False,
        annotations: Optional[List[str]] = None,
        geometries: str = "geojson",
        overview: str = "full",
        continue_straight: Optional[bool] = None,
        waypoints: Optional[List[int]] = None,
        exclude: Optional[List[str]] = None,
        bearings: Optional[List[Tuple[int, int]]] = None,
        radiuses: Optional[List[float]] = None,
        hints: Optional[List[Optional[str]]] = None,
        approaches: Optional[List[Optional[str]]] = None,
    ) -> Optional[Dict[str, Any]]:
        if not coords:
            return None
        coord_str = cls._coord_str(coords)
        params = {
            "geometries": geometries,
            "overview": overview,
            "steps": str(steps).lower(),
        }
        if alternatives:
            params["alternatives"] = (
                alternatives if isinstance(alternatives, int) else "true"
            )
        if annotations:
            params["annotations"] = ",".join(annotations)
        if continue_straight is not None:
            params["continue_straight"] = str(continue_straight).lower()
        if waypoints:
            params["waypoints"] = ";".join(str(w) for w in waypoints)
        if exclude:
            params["exclude"] = ",".join(exclude)
        if bearings:
            params["bearings"] = ";".join(f"{b[0]},{b[1]}" for b in bearings)
        if radiuses:
            params["radiuses"] = ";".join(
                str(r) if r is not None else "" for r in radiuses
            )
        if hints:
            params["hints"] = ";".join(h if h else "" for h in hints)
        if approaches:
            params["approaches"] = ";".join(a if a else "" for a in approaches)

        return cls._get(f"/route/v1/{profile}/{coord_str}", params)

    @classmethod
    def table(
        cls,
        *coords: Tuple[float, float],
        profile: str = DEFAULT_PROFILE,
        sources: Optional[List[int]] = None,
        destinations: Optional[List[int]] = None,
        annotations: Optional[List[str]] = None,
        fallback_speed: Optional[float] = None,
        fallback_coordinate: Optional[str] = None,
        scale_factor: Optional[float] = None,
    ) -> Optional[Dict[str, Any]]:
        if not coords:
            return None
        coord_str = cls._coord_str(coords)
        params: Dict[str, Any] = {}
        if sources:
            params["sources"] = ";".join(str(s) for s in sources)
        if destinations:
            params["destinations"] = ";".join(str(d) for d in destinations)
        if annotations:
            params["annotations"] = ",".join(annotations)
        if fallback_speed is not None:
            params["fallback_speed"] = fallback_speed
        if fallback_coordinate:
            params["fallback_coordinate"] = fallback_coordinate
        if scale_factor is not None:
            params["scale_factor"] = scale_factor

        return cls._get(f"/table/v1/{profile}/{coord_str}", params)

    @classmethod
    def nearest(
        cls,
        coord: Tuple[float, float],
        profile: str = DEFAULT_PROFILE,
        number_of_results: int = 1,
        bearings: Optional[List[Tuple[int, int]]] = None,
        radiuses: Optional[List[float]] = None,
    ) -> Optional[Dict[str, Any]]:
        coord_str = f"{coord[0]},{coord[1]}"
        params: Dict[str, Any] = {"number": number_of_results}
        if bearings:
            params["bearings"] = ";".join(f"{b[0]},{b[1]}" for b in bearings)
        if radiuses:
            params["radiuses"] = ";".join(str(r) for r in radiuses)

        return cls._get(f"/nearest/v1/{profile}/{coord_str}", params)

    @classmethod
    def match(
        cls,
        *coords: Tuple[float, float],
        profile: str = DEFAULT_PROFILE,
        timestamps: Optional[List[int]] = None,
        radiuses: Optional[List[float]] = None,
        steps: bool = False,
        annotations: Optional[List[str]] = None,
        geometries: str = "geojson",
        overview: str = "full",
        gaps: str = "split",
        tidy: bool = False,
        waypoints: Optional[List[int]] = None,
    ) -> Optional[Dict[str, Any]]:
        if not coords:
            return None
        coord_str = cls._coord_str(coords)
        params: Dict[str, Any] = {
            "steps": str(steps).lower(),
            "geometries": geometries,
            "overview": overview,
            "gaps": gaps,
            "tidy": str(tidy).lower(),
        }
        if timestamps:
            params["timestamps"] = ";".join(str(t) for t in timestamps)
        if radiuses:
            params["radiuses"] = ";".join(str(r) for r in radiuses)
        if annotations:
            params["annotations"] = ",".join(annotations)
        if waypoints:
            params["waypoints"] = ";".join(str(w) for w in waypoints)

        return cls._get(f"/match/v1/{profile}/{coord_str}", params)

    @classmethod
    def trip(
        cls,
        *coords: Tuple[float, float],
        profile: str = DEFAULT_PROFILE,
        roundtrip: bool = True,
        source: str = "any",
        destination: str = "any",
        steps: bool = False,
        annotations: Optional[List[str]] = None,
        geometries: str = "geojson",
        overview: str = "full",
    ) -> Optional[Dict[str, Any]]:
        if not coords:
            return None
        coord_str = cls._coord_str(coords)
        params: Dict[str, Any] = {
            "roundtrip": str(roundtrip).lower(),
            "source": source,
            "destination": destination,
            "steps": str(steps).lower(),
            "geometries": geometries,
            "overview": overview,
        }
        if annotations:
            params["annotations"] = ",".join(annotations)

        return cls._get(f"/trip/v1/{profile}/{coord_str}", params)

    @classmethod
    def tile(
        cls,
        x: int,
        y: int,
        z: int,
        profile: str = DEFAULT_PROFILE,
    ) -> Optional[bytes]:
        url = f"{cls.BASE_URL}/tile/v1/{profile}/tile({x},{y},{z}).mvt"
        try:
            response = requests.get(url, timeout=10)
            response.raise_for_status()
            return response.content
        except requests.RequestException as e:
            logger.error(f"OSRM tile request failed: {e}")
            return None

    @classmethod
    def _route_snap_is_valid(cls, result: Dict[str, Any]) -> bool:
        """Reject OSRM results snapped far from requested coordinates.

        A regional extract can return ``code=Ok`` even when both input points
        snap hundreds of kilometres away. The resulting distance and duration
        are not valid for the requested ride, so both route and fare paths must
        apply the same coverage check.
        """
        waypoints = result.get("waypoints") or []
        if len(waypoints) != 2:
            logger.warning("OSRM route omitted origin/destination snap metadata")
            return False
        try:
            snap_distances = [float(point["distance"]) for point in waypoints]
        except (KeyError, TypeError, ValueError):
            logger.warning("OSRM route returned invalid waypoint snap metadata")
            return False

        max_snap_distance_m = float(
            getattr(settings, "OSRM_MAX_SNAP_DISTANCE_M", 5000)
        )
        if any(distance > max_snap_distance_m for distance in snap_distances):
            logger.warning(
                "OSRM route rejected: waypoint snap distances %s exceed %sm",
                snap_distances,
                max_snap_distance_m,
            )
            return False
        return True

    @classmethod
    def get_road_metrics(
        cls,
        origin: Tuple[float, float],
        destination: Tuple[float, float],
    ) -> Optional[Dict[str, float]]:
        """Return road distance + duration for an origin/destination pair.

        Uses a single /route call; results are cached for ``CACHE_TTL``.
        """
        cache_key = f"osrm_metrics_v4_{origin[1]}_{origin[0]}_{destination[1]}_{destination[0]}"
        cached = cache.get(cache_key)
        if cached is not None:
            return cached

        result = cls.route(origin, destination, overview="false")
        if not result or not result.get("routes") or not cls._route_snap_is_valid(result):
            return None
        route = result["routes"][0]
        metrics = {
            "distance": route["distance"],
            "duration": route["duration"],
        }
        cache.set(cache_key, metrics, cls.CACHE_TTL)
        return metrics

    @classmethod
    def get_road_path(
        cls,
        origin: Tuple[float, float],
        destination: Tuple[float, float],
    ) -> Optional[Dict[str, Any]]:
        """Return road path geometry + metrics for an origin/destination pair.

        Returns ``{ distance, duration, geometry }`` where ``geometry`` is the
        full GeoJSON LineString dict from OSRM. Uses a single /route call with
        ``overview=full``; results are cached for ``CACHE_TTL``.
        """
        cache_key = f"osrm_path_v4_{origin[1]}_{origin[0]}_{destination[1]}_{destination[0]}"
        cached = cache.get(cache_key)
        if cached is not None:
            return cached

        result = cls.route(origin, destination, overview="full", geometries="geojson")
        if not result or not result.get("routes"):
            return None

        # Never build a journey from geometry outside the requested region.
        if not cls._route_snap_is_valid(result):
            return None

        route = result["routes"][0]
        payload = {
            "distance": route["distance"],
            "duration": route["duration"],
            "geometry": route.get("geometry"),
        }
        cache.set(cache_key, payload, cls.CACHE_TTL)
        return payload

    @classmethod
    def get_walking_path(
        cls,
        origin: Tuple[float, float],
        destination: Tuple[float, float],
    ) -> Optional[Dict[str, Any]]:
        """Return a road-following path and a walking-time estimate."""
        profile = cls.WALKING_PROFILE or cls.DEFAULT_PROFILE
        cache_key = f"osrm_walk_v4_{profile}_{origin[1]}_{origin[0]}_{destination[1]}_{destination[0]}"
        cached = cache.get(cache_key)
        if cached is not None:
            return cached

        result = cls.route(
            origin,
            destination,
            profile=profile,
            overview="full",
            geometries="geojson",
        )
        if not result or not result.get("routes") or not cls._route_snap_is_valid(result):
            return None

        route = result["routes"][0]
        geometry = route.get("geometry")
        if not geometry or geometry.get("type") != "LineString" or len(geometry.get("coordinates") or []) < 2:
            return None
        payload = {
            "distance": route["distance"],
            # The configured OSRM image is car-profile; use its road distance,
            # never its vehicle ETA, for a human walking-time estimate.
            "duration": route["distance"] / cls.WALKING_SPEED_MPS,
            "geometry": geometry,
            "profile": profile,
            "duration_is_estimate": True,
        }
        cache.set(cache_key, payload, cls.CACHE_TTL)
        return payload

    @classmethod
    def get_road_path_through(cls, *coords: Tuple[float, float]) -> Optional[Dict[str, Any]]:
        """Return actual driving geometry through ordered stop coordinates."""
        if len(coords) < 2:
            return None
        key_points = ";".join(f"{lng:.6f},{lat:.6f}" for lng, lat in coords)
        cache_key = f"osrm_path_through_v3_{hashlib.sha256(key_points.encode()).hexdigest()}"
        cached = cache.get(cache_key)
        if cached is not None:
            return cached

        result = cls.route(*coords, overview="full", geometries="geojson")
        routes = (result or {}).get("routes") or []
        waypoints = (result or {}).get("waypoints") or []
        if not routes or len(waypoints) != len(coords):
            return None
        try:
            snap_distances = [float(point["distance"]) for point in waypoints]
        except (KeyError, TypeError, ValueError):
            return None
        max_snap_m = float(getattr(settings, "OSRM_MAX_SNAP_DISTANCE_M", 5000))
        if any(distance > max_snap_m for distance in snap_distances):
            return None
        route = routes[0]
        geometry = route.get("geometry")
        if not geometry or geometry.get("type") != "LineString" or len(geometry.get("coordinates") or []) < 2:
            return None
        payload = {
            "distance": route.get("distance"),
            "duration": route.get("duration"),
            "geometry": geometry,
        }
        cache.set(cache_key, payload, cls.CACHE_TTL)
        return payload

    @classmethod
    def get_road_distance_m(
        cls,
        origin: Tuple[float, float],
        destination: Tuple[float, float],
    ) -> Optional[float]:
        cache_key = f"osrm_dist_v4_{origin[1]}_{origin[0]}_{destination[1]}_{destination[0]}"
        cached = cache.get(cache_key)
        if cached is not None:
            return cached

        metrics = cls.get_road_metrics(origin, destination)
        if metrics is not None:
            cache.set(cache_key, metrics["distance"], cls.CACHE_TTL)
            return metrics["distance"]
        return None

    @classmethod
    def get_road_duration_s(
        cls,
        origin: Tuple[float, float],
        destination: Tuple[float, float],
    ) -> Optional[float]:
        cache_key = f"osrm_dur_v4_{origin[1]}_{origin[0]}_{destination[1]}_{destination[0]}"
        cached = cache.get(cache_key)
        if cached is not None:
            return cached

        metrics = cls.get_road_metrics(origin, destination)
        if metrics is not None:
            cache.set(cache_key, metrics["duration"], cls.CACHE_TTL)
            return metrics["duration"]
        return None

    @classmethod
    def get_cached_road_duration_s(
        cls,
        origin: Tuple[float, float],
        destination: Tuple[float, float],
    ) -> Optional[float]:
        """Return cached road duration without issuing a network request.

        Used inside serializers to avoid blocking HTTP calls in request hot paths.
        """
        cache_key = f"osrm_dur_v4_{origin[1]}_{origin[0]}_{destination[1]}_{destination[0]}"
        return cache.get(cache_key)

    @classmethod
    def get_cached_road_metrics(
        cls,
        origin: Tuple[float, float],
        destination: Tuple[float, float],
    ) -> Optional[Dict[str, float]]:
        """Return cached road metrics without issuing a network request."""
        cache_key = f"osrm_metrics_v4_{origin[1]}_{origin[0]}_{destination[1]}_{destination[0]}"
        return cache.get(cache_key)

    @classmethod
    def get_route_geometry(
        cls,
        *coords: Tuple[float, float],
    ) -> Optional[Dict[str, Any]]:
        result = cls.route(*coords, geometries="geojson", overview="full")
        if result and result.get("routes"):
            return result["routes"][0].get("geometry")
        return None

    @classmethod
    def get_distance_matrix(
        cls,
        coords: List[Tuple[float, float]],
        sources: Optional[List[int]] = None,
        destinations: Optional[List[int]] = None,
    ) -> Optional[Dict[str, Any]]:
        coord_key = "_".join(f"{c[0]}_{c[1]}" for c in coords)
        cache_key = f"osrm_matrix_v2_{coord_key}_{sources}_{destinations}"
        cached = cache.get(cache_key)
        if cached is not None:
            return cached

        result = cls.table(
            *coords,
            annotations=["duration", "distance"],
            sources=sources,
            destinations=destinations,
        )
        if result:
            cache.set(cache_key, result, cls.CACHE_TTL)
        return result

    @classmethod
    def get_nearest_road(
        cls,
        coord: Tuple[float, float],
        number: int = 1,
    ) -> Optional[List[Dict[str, Any]]]:
        result = cls.nearest(coord, number_of_results=number)
        if result and result.get("waypoints"):
            return result["waypoints"]
        return None

    @classmethod
    def match_trace(
        cls,
        trace: List[Tuple[float, float]],
        timestamps: Optional[List[int]] = None,
    ) -> Optional[Dict[str, Any]]:
        result = cls.match(
            *trace,
            timestamps=timestamps,
            geometries="geojson",
            overview="full",
        )
        return result
