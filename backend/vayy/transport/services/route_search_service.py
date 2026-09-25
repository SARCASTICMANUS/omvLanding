import logging
from collections import defaultdict
from concurrent.futures import ThreadPoolExecutor
from typing import Dict, Any, List, Optional, Tuple

from django.db.models import Q
from django.contrib.gis.geos import Point
from django.contrib.gis.measure import D
from django.contrib.gis.db.models.functions import Distance, ClosestPoint, Cast
from django.contrib.gis.db.models import GeometryField

from transport.models import Route, Stop
from transport.services.osrm_service import OSRMService
from operations.services.fare_service import FareService
from common.constants import VEHICLE_AUTO

logger = logging.getLogger(__name__)


# ============================================================================
# SERVICES
# ============================================================================

class RouteSearchService:
    MAX_OSRM_CANDIDATES = 15
    WALKING_SPEED_MPS = 1.33  # ~4.8 km/h standard walking speed

    @classmethod
    def search_routes(
        cls,
        origin_lat: float,
        origin_lng: float,
        dest_lat: float,
        dest_lng: float,
        radius: int,
    ) -> List[Dict[str, Any]]:
        origin_point = Point(origin_lng, origin_lat, srid=4326)
        dest_point = Point(dest_lng, dest_lat, srid=4326)
        search_radius = D(m=radius)

        # 1. Spatial Filtering
        candidate_pairs = cls._find_candidate_pairs(origin_point, dest_point, search_radius)
        if not candidate_pairs:
            return []

        # 2. Slice Top Candidates by lowest walking distance
        candidate_pairs.sort(key=lambda x: x["total_walk_m"])
        top_candidates = candidate_pairs[: cls.MAX_OSRM_CANDIDATES]

        # 3. Bulk Enrich Data, Fetch Road Distances & Sort
        return cls._enrich_candidates(top_candidates, origin_point, dest_point)

    @classmethod
    def _find_candidate_pairs(
        cls, origin_point: Point, dest_point: Point, search_radius: D
    ) -> List[Dict[str, Any]]:
        search_radius_m = search_radius.m

        # Single spatial query using PostGIS spatial index
        stops_list = list(
            Stop.objects.filter(
                Q(location__distance_lte=(origin_point, search_radius))
                | Q(location__distance_lte=(dest_point, search_radius))
            )
            .annotate(
                dist_to_origin=Distance("location", origin_point),
                dist_to_dest=Distance("location", dest_point),
            )
            .values(
                "route_id",
                "id",
                "order",
                "location",
                "name",
                "dist_to_origin",
                "dist_to_dest",
                "cumulative_distance_m",
                "cumulative_duration_s",
            )
        )

        if not stops_list:
            return []

        origin_by_route = defaultdict(list)
        dest_by_route = defaultdict(list)

        # Batch-extract float metrics once to avoid hasattr() inside loops
        for stop in stops_list:
            dist_orig_m = (
                stop["dist_to_origin"].m
                if hasattr(stop["dist_to_origin"], "m")
                else float(stop["dist_to_origin"])
            )
            dist_dest_m = (
                stop["dist_to_dest"].m
                if hasattr(stop["dist_to_dest"], "m")
                else float(stop["dist_to_dest"])
            )

            stop["dist_to_origin_m"] = dist_orig_m
            stop["dist_to_dest_m"] = dist_dest_m

            if dist_orig_m <= search_radius_m:
                origin_by_route[stop["route_id"]].append(stop)
            if dist_dest_m <= search_radius_m:
                dest_by_route[stop["route_id"]].append(stop)

        common_route_ids = origin_by_route.keys() & dest_by_route.keys()
        candidate_pairs = []

        for route_id in common_route_ids:
            best_pair = cls._select_best_stop_pair_fast(
                origin_by_route[route_id], dest_by_route[route_id]
            )
            if best_pair:
                candidate_pairs.append({
                    "route_id": route_id,
                    "pickup_stop": best_pair[0],
                    "dropoff_stop": best_pair[1],
                    "total_walk_m": best_pair[0]["dist_to_origin_m"] + best_pair[1]["dist_to_dest_m"],
                })

        return candidate_pairs

    @staticmethod
    def _select_best_stop_pair_fast(
        o_stops: List[Dict[str, Any]], d_stops: List[Dict[str, Any]]
    ) -> Optional[Tuple[Dict[str, Any], Dict[str, Any]]]:
        """
        Optimized O(N + M) candidate pair selection:
        Prunes invalid dropoff stops (order <= pickup order) and selects lowest walk distance.
        """
        best_pair = None
        min_total_walk = float("inf")

        d_stops_sorted = sorted(d_stops, key=lambda d: d["order"])

        for o_stop in o_stops:
            o_order = o_stop["order"]
            o_dist = o_stop["dist_to_origin_m"]

            for d_stop in d_stops_sorted:
                if d_stop["order"] <= o_order:
                    continue  # Direction check

                total_walk = o_dist + d_stop["dist_to_dest_m"]
                if total_walk < min_total_walk:
                    min_total_walk = total_walk
                    best_pair = (o_stop, d_stop)

        return best_pair

    @classmethod
    def _enrich_candidates(
        cls,
        candidates: List[Dict[str, Any]],
        origin_point: Point,
        dest_point: Point,
    ) -> List[Dict[str, Any]]:
        top_route_ids = [c["route_id"] for c in candidates]
        passenger_origin_coords = (origin_point.x, origin_point.y)
        passenger_dest_coords = (dest_point.x, dest_point.y)

        # Batch query route info and compute closest path point in 1 query
        routes_qs = (
            Route.objects.filter(id__in=top_route_ids)
            .select_related("city")
            .annotate(
                closest_pt=ClosestPoint(Cast("path", GeometryField()), origin_point),
                dist_to_route=Distance("path", origin_point),
            )
        )

        routes_map = {}
        route_closest_points = {}

        for r in routes_qs:
            routes_map[r.id] = {
                "id": str(r.id),
                "name": r.name,
                "route_code": r.route_code,
                "city_name": r.city.name if r.city else "",
                "start_name": r.start_name,
                "end_name": r.end_name,
                "total_distance_meters": r.total_distance_meters,
            }
            if hasattr(r, "closest_pt") and r.closest_pt:
                dist_m = (
                    r.dist_to_route.m
                    if hasattr(r.dist_to_route, "m")
                    else float(r.dist_to_route)
                )
                route_closest_points[r.id] = {
                    "location": {
                        "type": "Point",
                        "coordinates": [r.closest_pt.x, r.closest_pt.y],
                    },
                    "distance_meters": round(dist_m),
                }

        # Query all stops for top routes
        all_stops_qs = (
            Stop.objects.filter(route_id__in=top_route_ids)
            .order_by("route_id", "order")
            .values(
                "route_id",
                "id",
                "name",
                "order",
                "location",
                "cumulative_distance_m",
                "cumulative_duration_s",
            )
        )
        stops_by_route = defaultdict(list)
        for s in all_stops_qs:
            stops_by_route[s["route_id"]].append({
                "id": str(s["id"]),
                "name": s["name"],
                "order": s["order"],
                "lat": s["location"].y,
                "lon": s["location"].x,
                "location": {
                    "type": "Point",
                    "coordinates": [s["location"].x, s["location"].y],
                },
                "cumulative_distance_m": s["cumulative_distance_m"],
                "cumulative_duration_s": s["cumulative_duration_s"],
            })

        # Concurrent OSRM execution
        first_mile_futures = {}
        last_mile_futures = {}

        num_threads = min(30, max(1, len(candidates) * 2))
        with ThreadPoolExecutor(max_workers=num_threads) as executor:
            for candidate in candidates:
                route_id = candidate["route_id"]
                pickup = candidate["pickup_stop"]
                dropoff = candidate["dropoff_stop"]

                pickup_coords = (pickup["location"].x, pickup["location"].y)
                dropoff_coords = (dropoff["location"].x, dropoff["location"].y)

                first_mile_futures[route_id] = executor.submit(
                    cls._safe_get_road_metrics, passenger_origin_coords, pickup_coords
                )
                last_mile_futures[route_id] = executor.submit(
                    cls._safe_get_road_metrics, dropoff_coords, passenger_dest_coords
                )

        results = []
        for candidate in candidates:
            route_id = candidate["route_id"]
            pickup = candidate["pickup_stop"]
            dropoff = candidate["dropoff_stop"]
            route_info = routes_map[route_id]

            nearest_route_info = route_closest_points.get(route_id)
            nearest_road_distance = (
                nearest_route_info["distance_meters"]
                if nearest_route_info
                else pickup["dist_to_origin_m"]
            )

            # First mile metric resolution
            first_mile_res = first_mile_futures[route_id].result()
            if first_mile_res and "distance" in first_mile_res:
                nearest_road_stop_distance = first_mile_res["distance"]
                first_mile_duration_s = first_mile_res.get(
                    "duration", (nearest_road_stop_distance / cls.WALKING_SPEED_MPS)
                )
            else:
                nearest_road_stop_distance = pickup["dist_to_origin_m"]
                first_mile_duration_s = nearest_road_stop_distance / cls.WALKING_SPEED_MPS

            # Last mile metric resolution
            last_mile_res = last_mile_futures[route_id].result()
            if last_mile_res and "distance" in last_mile_res:
                last_mile_distance_m = last_mile_res["distance"]
                last_mile_duration_s = last_mile_res.get(
                    "duration", (last_mile_distance_m / cls.WALKING_SPEED_MPS)
                )
            else:
                last_mile_distance_m = dropoff["dist_to_dest_m"]
                last_mile_duration_s = last_mile_distance_m / cls.WALKING_SPEED_MPS

            # Transit distance / duration calculation
            cum_dist_dropoff = dropoff.get("cumulative_distance_m") or 0.0
            cum_dist_pickup = pickup.get("cumulative_distance_m") or 0.0
            cum_dur_dropoff = dropoff.get("cumulative_duration_s") or 0.0
            cum_dur_pickup = pickup.get("cumulative_duration_s") or 0.0

            transit_distance_m = max(0.0, cum_dist_dropoff - cum_dist_pickup)
            transit_duration_s = max(0.0, cum_dur_dropoff - cum_dur_pickup)

            # Geometric fallback if cumulative metrics are missing or zero in local DB
            if transit_distance_m == 0.0:
                p_pickup = Point(pickup["location"].x, pickup["location"].y, srid=4326)
                p_dropoff = Point(dropoff["location"].x, dropoff["location"].y, srid=4326)
                # Haversine degree distance * 111,000m * 1.25 route winding factor
                transit_distance_m = p_pickup.distance(p_dropoff) * 111000 * 1.25

            transit_distance_km = round(transit_distance_m / 1000.0, 1)

            if transit_duration_s == 0.0:
                transit_duration_s = (
                    (transit_distance_km / 25.0) * 3600 if transit_distance_km > 0 else 600
                )

            # Snap selection: compare saved path distance vs stop distance
            if nearest_road_distance < nearest_road_stop_distance:
                is_nearest_road_primary = True
                chosen_first_mile_m = nearest_road_distance
                chosen_first_mile_duration_s = nearest_road_distance / cls.WALKING_SPEED_MPS
            else:
                is_nearest_road_primary = False
                chosen_first_mile_m = nearest_road_stop_distance
                chosen_first_mile_duration_s = first_mile_duration_s

            total_walk_meters = round(chosen_first_mile_m + last_mile_distance_m)
            total_eta_seconds = int(
                chosen_first_mile_duration_s + transit_duration_s + last_mile_duration_s
            )

            nearest_road_payload = None
            if nearest_route_info:
                nearest_road_payload = {
                    "name": "Nearest Point on Saved Route",
                    "location": nearest_route_info["location"],
                    "distance_meters": nearest_route_info["distance_meters"],
                    "is_nearest": is_nearest_road_primary,
                }

            pickup_stop_payload = {
                "id": str(pickup["id"]),
                "name": pickup["name"],
                "order": pickup["order"],
                "lat": pickup["location"].y,
                "lon": pickup["location"].x,
                "location": {
                    "type": "Point",
                    "coordinates": [pickup["location"].x, pickup["location"].y],
                },
                "distance_meters": round(nearest_road_stop_distance),
                "is_nearest": not is_nearest_road_primary,
            }

            dropoff_stop_payload = {
                "id": str(dropoff["id"]),
                "name": dropoff["name"],
                "order": dropoff["order"],
                "lat": dropoff["location"].y,
                "lon": dropoff["location"].x,
                "location": {
                    "type": "Point",
                    "coordinates": [dropoff["location"].x, dropoff["location"].y],
                },
                "distance_to_destination_meters": round(last_mile_distance_m),
            }

            results.append({
                "id": str(route_id),
                "name": route_info["name"],
                "route_code": route_info["route_code"],
                "city_name": route_info["city_name"],
                "start_name": route_info["start_name"],
                "end_name": route_info["end_name"],
                "total_distance_meters": route_info["total_distance_meters"],
                "fare": int(FareService.calculate_fare(transit_distance_km, VEHICLE_AUTO)),
                "eta_seconds": total_eta_seconds,
                "walk_minutes": max(1, round(total_walk_meters / 80)),
                "walk_distance_meters": total_walk_meters,
                "first_mile_walk_meters": round(chosen_first_mile_m),
                "last_mile_walk_meters": round(last_mile_distance_m),
                "distance_km": transit_distance_km,
                "pickup_stop": pickup_stop_payload,
                "dropoff_stop": dropoff_stop_payload,
                "stops": stops_by_route[route_id],
                "nearest_road": nearest_road_payload,
                "nearest_road_distance": round(nearest_road_distance),
                "nearest_road_stop_distance": round(nearest_road_stop_distance),
            })

        results.sort(key=lambda x: (x["distance_km"], x["walk_distance_meters"]))
        return results

    @staticmethod
    def _safe_get_road_metrics(
        origin: Tuple[float, float], destination: Tuple[float, float]
    ) -> Optional[Dict[str, Any]]:
        try:
            return OSRMService.get_road_metrics(origin, destination)
        except Exception as e:
            logger.warning(
                f"OSRM road metrics query failed for {origin} -> {destination}: {e}"
            )
            return None