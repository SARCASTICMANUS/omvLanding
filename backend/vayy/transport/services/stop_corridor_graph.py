"""Pure stop-graph helpers for route-corridor selection (no Django dependency)."""
from heapq import heappop, heappush
from math import asin, cos, radians, sin, sqrt
from collections import defaultdict


def haversine_m(lat1, lon1, lat2, lon2):
    radius_m = 6_371_000
    d_lat = radians(lat2 - lat1)
    d_lon = radians(lon2 - lon1)
    a = sin(d_lat / 2) ** 2 + cos(radians(lat1)) * cos(radians(lat2)) * sin(d_lon / 2) ** 2
    return 2 * radius_m * asin(sqrt(min(1.0, a)))


def find_stop_corridor(
    stops,
    origin,
    destination,
    max_walk_m=3000,
    transfer_radius_m=100,
    transfer_penalty_m=250,
):
    """Return a directed stop path joining nearby origin/destination access stops.

    Route edges follow increasing stop order. Transfers are allowed only between
    stops on different routes that are physically close, preventing arbitrary
    city-wide straight-line route stitching.
    """
    nodes = {}
    by_route = defaultdict(list)
    for stop in stops:
        try:
            stop_id = str(stop["id"])
            route_id = str(stop["route_id"])
            order = int(stop["order"])
            lat = float(stop["lat"])
            lon = float(stop["lon"])
        except (KeyError, TypeError, ValueError):
            continue
        if not (-90 <= lat <= 90 and -180 <= lon <= 180):
            continue
        node = {**stop, "id": stop_id, "route_id": route_id, "order": order, "lat": lat, "lon": lon}
        nodes[stop_id] = node
        by_route[route_id].append(node)

    if len(nodes) < 2:
        return None

    graph = defaultdict(list)
    for route_nodes in by_route.values():
        route_nodes.sort(key=lambda item: item["order"])
        for left, right in zip(route_nodes, route_nodes[1:]):
            if left["id"] == right["id"] or right["order"] <= left["order"]:
                continue
            distance = haversine_m(left["lat"], left["lon"], right["lat"], right["lon"])
            graph[left["id"]].append((right["id"], max(distance, 1.0), "route"))

    # Spatial buckets avoid comparing every stop with every other stop.
    cell_size = 0.001
    buckets = defaultdict(list)
    for node in nodes.values():
        cell = (int(node["lat"] / cell_size), int(node["lon"] / cell_size))
        buckets[cell].append(node)

    for node in nodes.values():
        lat_cell = int(node["lat"] / cell_size)
        lon_cell = int(node["lon"] / cell_size)
        for lat_offset in (-2, -1, 0, 1, 2):
            for lon_offset in (-2, -1, 0, 1, 2):
                for other in buckets.get((lat_cell + lat_offset, lon_cell + lon_offset), []):
                    if node["route_id"] == other["route_id"] or node["id"] >= other["id"]:
                        continue
                    distance = haversine_m(node["lat"], node["lon"], other["lat"], other["lon"])
                    if distance <= transfer_radius_m:
                        weight = max(1.0, distance) + transfer_penalty_m
                        graph[node["id"]].append((other["id"], weight, "transfer"))
                        graph[other["id"]].append((node["id"], weight, "transfer"))

    def access_candidates(point):
        try:
            lat, lon = float(point["lat"]), float(point["lng"])
        except (KeyError, TypeError, ValueError):
            return []
        candidates = []
        for node in nodes.values():
            distance = haversine_m(lat, lon, node["lat"], node["lon"])
            if distance <= max_walk_m:
                candidates.append((distance, node["id"]))
        return sorted(candidates)

    starts = access_candidates(origin)
    targets = {stop_id: distance for distance, stop_id in access_candidates(destination)}
    if not starts or not targets:
        return None

    best = None
    best_cost = float("inf")
    for origin_walk_m, start_id in starts:
        distances = {start_id: 0.0}
        previous = {}
        heap = [(0.0, start_id)]
        while heap:
            current_cost, current_id = heappop(heap)
            if current_cost != distances.get(current_id):
                continue
            if current_cost + origin_walk_m >= best_cost:
                continue
            for next_id, edge_cost, edge_type in graph.get(current_id, []):
                next_cost = current_cost + edge_cost
                if next_cost < distances.get(next_id, float("inf")):
                    distances[next_id] = next_cost
                    previous[next_id] = (current_id, edge_type)
                    heappush(heap, (next_cost, next_id))

        for target_id, destination_walk_m in targets.items():
            if target_id not in distances:
                continue
            cost = origin_walk_m + distances[target_id] + destination_walk_m
            if cost >= best_cost:
                continue
            path_ids = [target_id]
            edge_types = []
            while path_ids[-1] != start_id:
                predecessor = previous.get(path_ids[-1])
                if predecessor is None:
                    path_ids = []
                    break
                parent_id, edge_type = predecessor
                edge_types.append(edge_type)
                path_ids.append(parent_id)
            if len(path_ids) < 2:
                continue
            path_ids.reverse()
            edge_types.reverse()
            best_cost = cost
            best = {
                "stops": [nodes[node_id] for node_id in path_ids],
                "first_mile_walk_meters": round(origin_walk_m),
                "last_mile_walk_meters": round(destination_walk_m),
                "transfer_count": sum(1 for edge_type in edge_types if edge_type == "transfer"),
                "cost_m": round(cost),
            }
    return best
