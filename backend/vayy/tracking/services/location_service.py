import logging
import math
from typing import Dict, Any, Optional, List, Tuple
from django.utils import timezone
from django.db import transaction
from django.contrib.gis.geos import Point
from django.core.cache import cache
from asgiref.sync import async_to_sync
from channels.layers import get_channel_layer

from operations.models import Vehicle, ActiveTrip, VehicleState
from tracking.models import HybridLog
from tracking.services.geo_service import GeoService
from tracking.services.redis_geo_service import RedisGeoService
from tracking.services.redis_route_service import RedisRouteService

logger = logging.getLogger(__name__)


# ──────────────────────────────────────────────────────────────
# Route geometry helpers
# ──────────────────────────────────────────────────────────────

def _point_to_tuple(point: Point) -> Tuple[float, float]:
    """Return (lng, lat) tuple from a PostGIS Point."""
    return (point.x, point.y)


def _haversine_m(p1: Tuple[float, float], p2: Tuple[float, float]) -> float:
    """Great-circle distance in metres between two (lng, lat) points."""
    lon1, lat1 = math.radians(p1[1]), math.radians(p1[0])
    lon2, lat2 = math.radians(p2[1]), math.radians(p2[0])
    dlat = lat2 - lat1
    dlon = lon2 - lon1
    a = math.sin(dlat / 2) ** 2 + math.cos(lat1) * math.cos(lat2) * math.sin(dlon / 2) ** 2
    return 2 * 6371000 * math.asin(math.sqrt(a))


def _project_point_on_linestring(
    point: Tuple[float, float],
    coords: List[Tuple[float, float]],
) -> Tuple[int, float, float, float]:
    """
    Project a (lng, lat) point onto a polyline (list of (lng, lat) coords).
    Returns (segment_index, fraction_along_segment, distance_to_line_m, distance_along_m).
    """
    best_dist = float("inf")
    best_seg = 0
    best_frac = 0.0
    cumul_before = 0.0

    for i in range(len(coords) - 1):
        seg_len = _haversine_m(coords[i], coords[i + 1])
        if seg_len < 1e-9:
            cumul_before += seg_len
            continue

        # Vector from A to B in flat-earth approximation (metres)
        ax, ay = coords[i]
        bx, by = coords[i + 1]
        px, py = point

        abx = (bx - ax) * math.cos(math.radians((ay + by) / 2)) * 111320
        aby = (by - ay) * 110540
        apx = (px - ax) * math.cos(math.radians((ay + py) / 2)) * 111320
        apy = (py - ay) * 110540

        dot = apx * abx + apy * aby
        t = max(0.0, min(1.0, dot / (abx * abx + aby * aby + 1e-12)))

        proj_x = ax + t * (bx - ax)
        proj_y = ay + t * (by - ay)
        dist = _haversine_m(point, (proj_x, proj_y))

        if dist < best_dist:
            best_dist = dist
            best_seg = i
            best_frac = t
            best_cumul = cumul_before + t * seg_len

        cumul_before += seg_len

    return best_seg, best_frac, best_dist, best_cumul


def _snap_to_route(
    point: Tuple[float, float],
    route_coords: List[Tuple[float, float]],
) -> Tuple[Tuple[float, float], int, float, float]:
    """
    Snap a GPS point to the nearest point on the route polyline.
    Returns (snapped_lnglat, segment_index, distance_to_route_m, distance_along_m).
    """
    seg, frac, dist, cumul = _project_point_on_linestring(point, route_coords)
    ax, ay = route_coords[seg]
    bx, by = route_coords[seg + 1]
    snapped = (ax + frac * (bx - ax), ay + frac * (by - ay))
    return snapped, seg, dist, cumul


def _determine_direction(
    stops: list,
    route_start: Tuple[float, float],
    route_end: Tuple[float, float],
    vehicle_point: Tuple[float, float],
    snapped_dist_from_start: float,
    total_route_length: float,
) -> str:
    """
    Determine if the vehicle is heading outbound or inbound.
    Outbound = first stop → last stop; Inbound = last → first.
    Uses the snapped distance along route vs total length heuristic,
    plus heading if available.
    """
    # Heuristic: if past halfway point, likely inbound
    midpoint = total_route_length / 2.0
    return "outbound" if snapped_dist_from_start < midpoint else "inbound"


def _compute_downstream_etas(
    stops: list,
    current_stop_index: int,
    direction: str,
    distance_along_m: float,
    speed_mps: float = 8.0,
) -> Dict[str, float]:
    """
    Compute ETAs (in seconds) to each downstream stop.
    Uses pre-computed cumulative distances on stops.
    Returns { stop_id: eta_seconds } for stops ahead.
    """
    etas: Dict[str, float] = {}
    if direction == "outbound":
        downstream = [s for s in stops if s.order > current_stop_index]
    else:
        downstream = [s for s in stops if s.order < current_stop_index]
        downstream.reverse()

    for stop in downstream:
        remaining = stop.cumulative_distance_m - distance_along_m
        if remaining < 0:
            remaining = 0
        # Use OSRM-based duration if available, else estimate from speed
        if stop.cumulative_duration_s > 0:
            elapsed_fraction = distance_along_m / max(stop.cumulative_distance_m, 1)
            eta = stop.cumulative_duration_s * (1 - elapsed_fraction)
        else:
            eta = remaining / max(speed_mps, 1.0)
        etas[str(stop.id)] = max(0, round(eta, 1))

    return etas


class LocationService:

    # ── WebSocket broadcast helper ───────────────────────────

    @staticmethod
    def _notify_ws(group_name: str, event_type: str, data: Dict[str, Any]):
        try:
            channel_layer = get_channel_layer()
            async_to_sync(channel_layer.group_send)(group_name, {"type": event_type, "data": data})
        except Exception as e:
            logger.warning(f"WS broadcast failed for {group_name}: {e}")

    # ── main entry point ─────────────────────────────────────

    @staticmethod
    def process_location_update(payload: Dict[str, Any]) -> Optional[VehicleState]:
        vehicle_id = payload.get("vehicle_id")
        lat = payload.get("lat")
        lng = payload.get("lng") or payload.get("lon")
        speed = payload.get("speed", 0)
        heading = payload.get("heading", 0)
        trip_id = payload.get("trip_id")

        if not vehicle_id or lat is None or lng is None:
            logger.error(f"Invalid location update payload: {payload}")
            return None

        try:
            vehicle = Vehicle.objects.get(id=vehicle_id)
            point = GeoService.create_point(lat, lng)
            gps_tuple = (lng, lat)
            speed_mps = speed * 1000 / 3600  # km/h → m/s

            state: Optional[VehicleState] = None

            with transaction.atomic():
                # ── 1. Update VehicleState (always) ──────────────
                state, _ = VehicleState.objects.get_or_create(vehicle=vehicle)
                state.speed_kmph = speed
                state.heading = heading
                state.current_location = point
                state.last_updated = timezone.now()

                # ── 2. Resolve active trip ───────────────────────
                active_trip = None
                if trip_id:
                    try:
                        active_trip = ActiveTrip.objects.get(id=trip_id, status__in=["accepted", "arrived", "active"])
                    except ActiveTrip.DoesNotExist:
                        logger.warning(f"ActiveTrip {trip_id} not found")

                if not active_trip:
                    active_trip = ActiveTrip.objects.filter(vehicle=vehicle, status__in=["accepted", "arrived", "active"]).first()

                # ── 3. Store HybridLog for persistence ───────────
                try:
                    driver = vehicle.driver if hasattr(vehicle, "driver") and vehicle.driver else None
                    HybridLog.objects.create(
                        user=driver,
                        vehicle=vehicle,
                        trip=active_trip,
                        location=point,
                        speed=speed,
                        heading=heading,
                        timestamp=timezone.now(),
                    )
                except Exception as e:
                    logger.warning(f"Failed to store HybridLog: {e}")

                # ── 4. Route-based processing ────────────────────
                next_stop_eta_list = []
                etas = {}
                dist_along = None
                snapped = None
                remaining_distance_km = None
                remaining_duration_min = None
                direction = None
                if active_trip:
                    route_stops = list(
                        active_trip.route.stops.select_related("route").order_by("order")
                    )

                    if route_stops:
                        route_coords = LocationService._get_route_coords(route_stops)

                        # 4a. Snap GPS to route
                        snapped, seg_idx, dist_to_route, dist_along = _snap_to_route(gps_tuple, route_coords)
                        state.snapped_location = Point(snapped[0], snapped[1], srid=4326)
                        state.distance_along_route_m = dist_along

                        # 4b. Determine direction
                        direction = _determine_direction(
                            route_stops,
                            _point_to_tuple(route_stops[0].location),
                            _point_to_tuple(route_stops[-1].location),
                            gps_tuple,
                            dist_along,
                            route_stops[-1].cumulative_distance_m,
                        )
                        active_trip.direction = direction

                        # 4c. Determine current stop & segment
                        stop_idx, segment_idx = LocationService._find_current_stop(
                            route_stops, direction, dist_along
                        )
                        current_stop = route_stops[stop_idx] if stop_idx < len(route_stops) else route_stops[-1]
                        state.current_stop_index = current_stop.order
                        state.current_segment_index = segment_idx
                        state.active_trip = active_trip

                        active_trip.current_stop = current_stop
                        active_trip.current_segment_index = segment_idx
                        active_trip.current_location = point
                        active_trip.last_updated = timezone.now()
                        active_trip.save(update_fields=[
                            "current_location", "last_updated",
                            "direction", "current_stop", "current_segment_index",
                        ])

                        # 4d. Compute downstream ETAs
                        etas = _compute_downstream_etas(
                            route_stops, current_stop.order, direction, dist_along, speed_mps
                        )
                        next_stop_eta_list = LocationService._build_eta_list(etas, route_stops, direction)

                state.save()

                def _post_commit():
                    # ── 5. Cache route state + WS broadcast (after commit) ──
                    try:
                        if active_trip and route_stops and snapped is not None and direction:
                            RedisRouteService.set_vehicle_route_state(
                                vehicle_id=str(vehicle_id),
                                route_id=str(active_trip.route_id),
                                direction=direction,
                                current_stop_index=current_stop.order,
                                current_segment_index=segment_idx,
                                distance_along_route_m=dist_along,
                                last_stop_id=str(current_stop.id),
                                eta_to_next_stop_s=list(etas.values())[0] if etas else None,
                                snapped_lat=snapped[1],
                                snapped_lng=snapped[0],
                            )
                            RedisRouteService.set_vehicle_etas(str(vehicle_id), etas)
                            RedisRouteService.add_vehicle_to_route(
                                str(active_trip.route_id), str(vehicle_id),
                                current_stop.order, direction,
                            )
                    except Exception as e:
                        logger.warning(f"Failed to cache route state in Redis: {e}")

                    # ── 6. Sync location to Redis GEO ─────────────
                    try:
                        RedisGeoService.add_vehicle(
                            vehicle_id=str(vehicle_id),
                            lat=lat,
                            lng=lng,
                            vehicle_type=vehicle.vehicle_type,
                            driver_id=str(vehicle.driver_id) if vehicle.driver_id else None,
                            vehicle_number=vehicle.vehicle_number,
                            trip_id=str(active_trip.id) if active_trip else None,
                        )
                    except Exception as e:
                        logger.warning(f"Failed to sync to Redis GEO: {e}")

                    # ── 7. Broadcast via WebSocket ────────────────
                    total_route_m = 0
                    if route_stops:
                        total_route_m = max(
                            (s.cumulative_distance_m for s in route_stops if s.cumulative_distance_m),
                            default=0
                        )
                    remaining_m = max(0, total_route_m - (dist_along or 0))
                    remaining_distance_km = round(remaining_m / 1000, 2)
                    remaining_duration_min = None
                    if etas:
                        remaining_duration_min = round(max(etas.values()) / 60, 1)

                    ws_payload = {
                        "type": "vehicle_update",
                        "lat": lat,
                        "lng": lng,
                        "speed": speed,
                        "heading": heading,
                        "vehicle_id": str(vehicle_id),
                        "trip_id": str(active_trip.id) if active_trip else None,
                        "route_id": str(active_trip.route_id) if active_trip else None,
                        "direction": active_trip.direction if active_trip else None,
                        "current_stop_index": state.current_stop_index,
                        "remaining_distance_km": remaining_distance_km,
                        "remaining_duration_min": remaining_duration_min,
                        "next_stop_eta": next_stop_eta_list,
                        "snapped_lat": state.snapped_location.y if state.snapped_location else None,
                        "snapped_lng": state.snapped_location.x if state.snapped_location else None,
                        "timestamp": state.last_updated.isoformat(),
                    }

                    LocationService._notify_ws(f"vehicle_{vehicle_id}", "vehicle_update", ws_payload)
                    if active_trip:
                        LocationService._notify_ws(f"trip_{active_trip.id}", "trip_update", ws_payload)
                        LocationService._notify_ws(
                            f"route_{active_trip.route_id}",
                            "route_vehicle_update",
                            ws_payload,
                        )

                transaction.on_commit(_post_commit)

            logger.info(
                f"Updated vehicle {vehicle_id}: stop={state.current_stop_index} "
                f"seg={state.current_segment_index} dir={active_trip.direction if active_trip else 'N/A'}"
            )
            return state

        except Vehicle.DoesNotExist:
            logger.error(f"Vehicle {vehicle_id} not found")
            return None
        except Exception as e:
            logger.exception(f"Error processing location update: {e}")
            raise

    # ── internal helpers ─────────────────────────────────────

    @staticmethod
    def _get_route_coords(stops: list) -> List[Tuple[float, float]]:
        """
        Build a full coordinate list from stop locations, cached in Redis
        per route so the polyline is not rebuilt on every GPS ping.
        Stops must belong to a single route.
        """
        if not stops:
            return []
        route_id = stops[0].route_id
        cache_key = f"route_coords_{route_id}"
        cached = cache.get(cache_key)
        if cached is not None:
            return cached

        coords = LocationService._build_route_coords(stops)
        cache.set(cache_key, coords, timeout=3600)
        return coords

    @staticmethod
    def _build_route_coords(stops: list) -> List[Tuple[float, float]]:
        """
        Build a full coordinate list from stop locations.
        If stops have geometry (line segments), interpolate intermediate points.
        Otherwise, just use stop locations as waypoints.
        """
        coords: List[Tuple[float, float]] = []
        for i, stop in enumerate(stops):
            stop_tuple = _point_to_tuple(stop.location)
            if i < len(stops) - 1 and stop.geometry:
                # Add geometry coords from this stop to next
                geom_coords = list(stop.geometry.coords)
                # Ensure first coord matches stop location
                if geom_coords and geom_coords[0] != stop_tuple:
                    geom_coords = [stop_tuple] + geom_coords
                coords.extend(geom_coords)
            else:
                coords.append(stop_tuple)
        return coords

    @staticmethod
    def _find_current_stop(
        stops: list,
        direction: str,
        distance_along_m: float,
    ) -> Tuple[int, int]:
        """
        Given the vehicle's distance along the route, find which stop it just
        passed (or is nearest to) and which segment it's on.
        Returns (stop_order_index, segment_index).
        """
        if direction == "outbound":
            ordered = sorted(stops, key=lambda s: s.order)
        else:
            ordered = sorted(stops, key=lambda s: s.order, reverse=True)

        current_stop_idx = 0
        for i, stop in enumerate(ordered):
            if stop.cumulative_distance_m <= distance_along_m + 50:  # 50m tolerance
                current_stop_idx = i
            else:
                break

        current_stop = ordered[current_stop_idx]
        segment_idx = current_stop.order  # segment between stop[order] and stop[order+1]
        return current_stop_idx, segment_idx

    @staticmethod
    def _build_eta_list(
        eta_map: Dict[str, float],
        stops: list,
        direction: str,
    ) -> List[Dict[str, Any]]:
        """
        Build the next_stop_eta list for WebSocket broadcast.
        Returns the top 3 nearest downstream stops with ETA.
        """
        stop_map = {str(s.id): s for s in stops}
        result = []
        for stop_id, eta_s in sorted(eta_map.items(), key=lambda x: x[1])[:3]:
            stop = stop_map.get(stop_id)
            if stop:
                result.append({
                    "stop_id": stop_id,
                    "stop_name": stop.name,
                    "eta_seconds": round(eta_s, 1),
                    "order": stop.order,
                })
        return result
