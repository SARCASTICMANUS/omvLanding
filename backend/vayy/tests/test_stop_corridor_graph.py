import os
import sys
import unittest

sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

from transport.services.stop_corridor_graph import find_stop_corridor


class StopCorridorGraphTests(unittest.TestCase):
    def setUp(self):
        self.stops = [
            {"id": "a1", "route_id": "A", "route_name": "Route A", "order": 1, "name": "A1", "lat": 28.5700, "lon": 77.3200},
            {"id": "a2", "route_id": "A", "route_name": "Route A", "order": 2, "name": "A2 Interchange", "lat": 28.5750, "lon": 77.3250},
            {"id": "a3", "route_id": "A", "route_name": "Route A", "order": 3, "name": "A3", "lat": 28.5800, "lon": 77.3300},
            {"id": "b1", "route_id": "B", "route_name": "Route B", "order": 1, "name": "B1 Interchange", "lat": 28.57505, "lon": 77.32505},
            {"id": "b2", "route_id": "B", "route_name": "Route B", "order": 2, "name": "B2", "lat": 28.5850, "lon": 77.3400},
        ]

    def test_builds_ordered_corridor_on_one_route(self):
        result = find_stop_corridor(
            self.stops, {"lat": 28.5701, "lng": 77.3201},
            {"lat": 28.5799, "lng": 77.3299}, max_walk_m=500,
        )
        self.assertIsNotNone(result)
        self.assertEqual([s["id"] for s in result["stops"]], ["a1", "a2", "a3"])
        self.assertEqual(result["transfer_count"], 0)

    def test_stitches_routes_at_nearby_interchange_stops(self):
        result = find_stop_corridor(
            self.stops, {"lat": 28.5701, "lng": 77.3201},
            {"lat": 28.5849, "lng": 77.3399}, max_walk_m=500,
        )
        self.assertIsNotNone(result)
        self.assertEqual(result["stops"][0]["id"], "a1")
        self.assertEqual(result["stops"][-1]["id"], "b2")
        self.assertEqual(result["transfer_count"], 1)
        self.assertIn("a2", [s["id"] for s in result["stops"]])
        self.assertIn("b1", [s["id"] for s in result["stops"]])

    def test_does_not_connect_unrelated_routes_or_distant_locations(self):
        result = find_stop_corridor(
            [{"id": "x1", "route_id": "X", "order": 1, "lat": 28.5, "lon": 77.3},
             {"id": "y1", "route_id": "Y", "order": 1, "lat": 28.7, "lon": 77.6}],
            {"lat": 28.5, "lng": 77.3}, {"lat": 28.7, "lng": 77.6},
            max_walk_m=500,
        )
        self.assertIsNone(result)

    def test_respects_route_direction_order(self):
        result = find_stop_corridor(
            [{"id": "a2", "route_id": "A", "order": 2, "lat": 28.57, "lon": 77.32},
             {"id": "a1", "route_id": "A", "order": 1, "lat": 28.58, "lon": 77.33}],
            {"lat": 28.57, "lng": 77.32}, {"lat": 28.58, "lng": 77.33},
            max_walk_m=100,
        )
        self.assertIsNone(result)


if __name__ == "__main__":
    unittest.main()