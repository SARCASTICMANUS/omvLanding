import logging
from collections import defaultdict
from typing import Dict, Any, List

from django.db.models import Q
from django.contrib.gis.geos import Point
from django.contrib.gis.measure import D
from django.contrib.gis.db.models.functions import Distance

from transport.models import Route, Stop
from transport.services.osrm_service import OSRMService
from operations.services.fare_service import FareService
from common.constants import VEHICLE_AUTO

logger = logging.getLogger(__name__)


class RouteSearchService:
    MAX_OSRM_CANDIDATES = 15

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

        # 3. Bulk Enrich Data, Compute Metrics & Sort by Distance
        return cls._enrich_candidates(top_candidates)

    @classmethod
    def _find_candidate_pairs(
        cls, origin_point: Point, dest_point: Point, search_radius: D
    ) -> List[Dict[str, Any]]:
        search_radius_m = search_radius.m

        stops_list = list(
            Stop.objects.filter(
                Q(location__distance_lte=(origin_point, search_radius))
                | Q(location__distance_lte=(dest_point, search_radius))
            )
            .annotate(
                dist_to_origin=Distance("location", origin_point),
                dist_to_dest=Distance("location", dest_point),
            )
            .values("route_id", "id", "order", "location", "name", "dist_to_origin", "dist_to_dest")
        )

        if not stops_list:
            return []

        origin_by_route = defaultdict(list)
        dest_by_route = defaultdict(list)

        for stop in stops_list:
            if stop["dist_to_origin"].m <= search_radius_m:
                origin_by_route[stop["route_id"]].append(stop)
            if stop["dist_to_dest"].m <= search_radius_m:
                dest_by_route[stop["route_id"]].append(stop)

        common_route_ids = set(origin_by_route.keys()) & set(dest_by_route.keys())
        candidate_pairs = []

        for route_id in common_route_ids:
            best_pair = cls._select_best_stop_pair(origin_by_route[route_id], dest_by_route[route_id])
            if best_pair:
                candidate_pairs.append({
                    "route_id": route_id,
                    "pickup_stop": best_pair[0],
                    "dropoff_stop": best_pair[1],
                    "total_walk_m": best_pair[0]["dist_to_origin"].m + best_pair[1]["dist_to_dest"].m,
                })

        return candidate_pairs

    @staticmethod
    def _select_best_stop_pair(o_stops: List[Dict], d_stops: List[Dict]):
        best_pair = None
        min_total_walk = float("inf")

        for o_stop in o_stops:
            o_walk = o_stop["dist_to_origin"].m

            # Directional & Sequence Check
            valid_d_stops = [
                d for d in d_stops
                if d["order"] > o_stop["order"]
                and o_stop["dist_to_origin"].m < d["dist_to_origin"].m
                and d["dist_to_dest"].m < o_stop["dist_to_dest"].m
            ]

            for d_stop in valid_d_stops:
                total_walk = o_walk + d_stop["dist_to_dest"].m
                if total_walk < min_total_walk:
                    min_total_walk = total_walk
                    best_pair = (o_stop, d_stop)

        return best_pair

    @classmethod
    def _enrich_candidates(cls, candidates: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        top_route_ids = [c["route_id"] for c in candidates]

        routes_map = {
            r["id"]: r
            for r in Route.objects.filter(id__in=top_route_ids)
            .select_related("city")
            .values("id", "name", "route_code", "city__name", "start_name", "end_name", "total_distance_meters")
        }

        all_stops = Stop.objects.filter(route_id__in=top_route_ids).order_by("route_id", "order")
        stops_by_route = defaultdict(list)
        for s in all_stops:
            stops_by_route[s.route_id].append(s)

        results = []
        for candidate in candidates:
            route_id = candidate["route_id"]
            pickup = candidate["pickup_stop"]
            dropoff = candidate["dropoff_stop"]
            route_info = routes_map[route_id]

            # Road Distance & Duration
            metrics = OSRMService.get_road_metrics(
                (pickup["location"].x, pickup["location"].y),
                (dropoff["location"].x, dropoff["location"].y),
            )

            if metrics and metrics.get("distance") is not None:
                stop_distance_m = metrics["distance"]
                stop_duration_s = metrics["duration"]
            else:
                stop_distance_m = pickup["location"].distance(dropoff["location"]) * 111319.5
                stop_duration_s = None

            stop_distance_km = round(stop_distance_m / 1000, 1)
            eta_seconds = (
                int(stop_duration_s)
                if (stop_duration_s and stop_duration_s > 0)
                else (int((stop_distance_km / 25) * 3600) if stop_distance_km > 0 else 600)
            )

            pickup_walk_m = pickup["dist_to_origin"].m

            results.append({
                "id": str(route_id),
                "name": route_info["name"],
                "route_code": route_info["route_code"],
                "city_name": route_info["city__name"] or "",
                "start_name": route_info["start_name"],
                "end_name": route_info["end_name"],
                "total_distance_meters": route_info["total_distance_meters"],
                "fare": int(FareService.calculate_fare(stop_distance_km, VEHICLE_AUTO)),
                "eta_seconds": eta_seconds,
                "walk_minutes": max(1, round(pickup_walk_m / 80)),
                "walk_distance_meters": round(pickup_walk_m),
                "distance_km": stop_distance_km,
                "pickup_stop": pickup,
                "dropoff_stop": dropoff,
                "stops": stops_by_route[route_id],
            })

        # Sort results from minimum distance to maximum distance (Primary: distance_km, Secondary: walk_distance_meters)
        results.sort(key=lambda x: (x["distance_km"], x["walk_distance_meters"]))

        return results