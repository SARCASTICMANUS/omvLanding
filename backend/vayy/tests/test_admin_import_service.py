"""Contract tests for admin route/stop file parsing (no Django/database needed)."""

import json
import unittest
from pathlib import Path

from transport.services.admin_import_service import (
    MASTER_V1_COLUMNS,
    decode_tabular_upload,
    normalize_master_v1,
    normalize_import_records,
    normalize_noida_route_stop_rows,
    parse_geojson_routes,
    parse_master_v1_geojson,
)


class AdminImportParsingTests(unittest.TestCase):
    @staticmethod
    def master_row(city_id, route_id, direction_id, sequence, stop_id, stop_name, lat, lng):
        return {
            "schema_version": "1",
            "city_id": city_id,
            "city_name": city_id.title(),
            "route_id": route_id,
            "route_number": "10",
            "route_name": "Demo Route",
            "direction_id": direction_id,
            "direction_name": direction_id.title(),
            "stop_sequence": str(sequence),
            "stop_id": stop_id,
            "stop_name": stop_name,
            "stop_aliases_json": "[]",
            "latitude": str(lat),
            "longitude": str(lng),
            "boarding_allowed": "true",
            "alighting_allowed": "true",
            "route_geometry_id": f"{city_id}-{route_id}-{direction_id}",
            "source_name": "fixture",
            "source_reference": "synthetic test fixture",
        }

    def test_v1_groups_by_city_route_and_direction_and_filters_city(self):
        rows = [
            self.master_row("lucknow", "R1", "out", 1, "S1", "A", 26.1, 80.1),
            self.master_row("lucknow", "R1", "out", 2, "S2", "B", 26.2, 80.2),
            self.master_row("lucknow", "R1", "in", 1, "S2", "B", 26.2, 80.2),
            self.master_row("lucknow", "R1", "in", 2, "S1", "A", 26.1, 80.1),
            self.master_row("noida", "R1", "out", 1, "S1", "C", 28.1, 77.1),
            self.master_row("noida", "R1", "out", 2, "S2", "D", 28.2, 77.2),
        ]

        groups, errors, excluded = normalize_master_v1(rows, "lucknow")

        self.assertEqual(set(groups), {("lucknow", "R1", "out"), ("lucknow", "R1", "in")})
        self.assertEqual(excluded, 2)
        self.assertEqual(errors, [])
        self.assertEqual(len(MASTER_V1_COLUMNS), 19)

    def test_v1_rejects_bad_sequence_coordinate_and_boolean(self):
        duplicate_rows = [
            self.master_row("lucknow", "R1", "out", 1, "S1", "A", 26.1, 80.1),
            self.master_row("lucknow", "R1", "out", 1, "S2", "B", 26.2, 80.2),
        ]
        _, duplicate_errors, _ = normalize_master_v1(duplicate_rows, "lucknow")
        self.assertTrue(any("duplicate stop_sequence" in item["reason"] for item in duplicate_errors))

        bad_coordinate = [
            self.master_row("lucknow", "R2", "out", 1, "S1", "A", 26.1, 80.1),
            self.master_row("lucknow", "R2", "out", 2, "S2", "B", 0, 0),
        ]
        _, coordinate_errors, _ = normalize_master_v1(bad_coordinate, "lucknow")
        self.assertTrue(any("latitude/longitude" in item["reason"] for item in coordinate_errors))

        bad_boolean = [
            self.master_row("lucknow", "R3", "out", 1, "S1", "A", 26.1, 80.1),
            self.master_row("lucknow", "R3", "out", 2, "S2", "B", 26.2, 80.2),
        ]
        bad_boolean[1]["boarding_allowed"] = "maybe"
        _, boolean_errors, _ = normalize_master_v1(bad_boolean, "lucknow")
        self.assertTrue(any("boarding_allowed" in item["reason"] for item in boolean_errors))

    def test_v1_geojson_uses_composite_city_route_key(self):
        payload = {
            "type": "FeatureCollection",
            "features": [
                {"type": "Feature", "properties": {"city_id": "lucknow", "route_id": "R1", "route_geometry_id": "lko-r1"},
                 "geometry": {"type": "LineString", "coordinates": [[80.1, 26.1], [80.2, 26.2]]}},
                {"type": "Feature", "properties": {"city_id": "noida", "route_id": "R1", "route_geometry_id": "noi-r1"},
                 "geometry": {"type": "LineString", "coordinates": [[77.1, 28.1], [77.2, 28.2]]}},
            ],
        }

        geometries, errors = parse_master_v1_geojson(json.dumps(payload).encode())

        self.assertIn(("lucknow", "R1"), geometries)
        self.assertIn(("noida", "R1"), geometries)
        self.assertNotEqual(geometries[("lucknow", "R1")]["coordinates"], geometries[("noida", "R1")]["coordinates"])
        self.assertEqual(errors, [])

    def test_v1_geojson_reports_malformed_feature_shapes(self):
        payload = {
            "type": "FeatureCollection",
            "features": [
                {"type": "Feature", "properties": [], "geometry": {}},
                {"type": "Feature", "properties": {"city_id": "lucknow", "route_id": "R1"},
                 "geometry": {"type": "LineString", "coordinates": "invalid"}},
            ],
        }

        geometries, errors = parse_master_v1_geojson(json.dumps(payload).encode())

        self.assertEqual(geometries, {})
        self.assertEqual(len(errors), 2)

    def test_flat_named_stop_csv_is_global_and_keeps_valid_coordinates(self):
        rows = decode_tabular_upload(
            b"stop_name,lat,lng\nStop A,26.8,80.9\nStop B,26.9,81.0\n",
            "csv",
        )

        routes, stops, errors, _ = normalize_import_records(rows)

        self.assertEqual(routes, {})
        self.assertEqual([stop["name"] for stop in stops], ["Stop A", "Stop B"])
        self.assertEqual(errors, [])

    def test_workspace_lucknow_csv_is_stop_only_not_a_route_corpus(self):
        source = Path(__file__).resolve().parents[2] / "lucknow_named_stops_coordinates.csv"
        if not source.is_file():
            self.skipTest("the optional workspace sample CSV is not present")

        rows = decode_tabular_upload(source.read_bytes(), "csv")
        routes, stops, errors, _ = normalize_import_records(rows)

        self.assertEqual(routes, {})
        self.assertGreater(len(stops), 0)
        self.assertEqual(errors, [])

    def test_route_csv_with_stops_ordered_json_preserves_order(self):
        children = [
            {"name": "Drop", "lat": 26.9, "lng": 81.0, "sequence": 2},
            {"name": "Pickup", "lat": 26.8, "lng": 80.9, "sequence": 1},
        ]
        rows = [{"route_name": "Route A", "route_code": "A1", "stops_ordered": json.dumps(children)}]

        routes, stops, errors, _ = normalize_import_records(rows)

        self.assertEqual(stops, [])
        self.assertEqual([point["name"] for point in routes[("Route A", "A1")]], ["Pickup", "Drop"])
        self.assertEqual(errors, [])

    def test_semicolon_csv_delimiter_is_detected(self):
        rows = decode_tabular_upload(
            b"stop_name;lat;lng\nStation A;26.8;80.9\nStation B;26.9;81.0\n",
            "csv",
        )

        routes, stops, errors, _ = normalize_import_records(rows)

        self.assertEqual(routes, {})
        self.assertEqual(len(stops), 2)
        self.assertEqual(errors, [])

    def test_json_route_mapping_uses_map_key_as_route_code(self):
        payload = {
            "routes": {
                "A1": {
                    "route_name": "Route A",
                    "stops": [
                        {"name": "Pickup", "lat": 26.8, "lng": 80.9},
                        {"name": "Drop", "lat": 26.9, "lng": 81.0},
                    ],
                }
            }
        }

        rows = decode_tabular_upload(json.dumps(payload).encode(), "json")
        routes, _, errors, _ = normalize_import_records(rows)

        self.assertEqual([point["name"] for point in routes[("Route A", "A1")]], ["Pickup", "Drop"])
        self.assertEqual(errors, [])

    def test_flat_route_rows_assign_order_from_file_order(self):
        rows = [
            {"route_name": "Route A", "stop_name": "Pickup", "lat": "26.8", "lng": "80.9"},
            {"route_name": "Route A", "stop_name": "Drop", "lat": "26.9", "lng": "81.0"},
        ]

        routes, _, errors, _ = normalize_import_records(rows)

        self.assertEqual([point["sequence"] for point in routes[("Route A", "")]], [0, 1])
        self.assertEqual(errors, [])

    def test_bad_coordinate_and_duplicate_sequence_are_reported(self):
        rows = [
            {"route_name": "Route A", "stop_name": "Pickup", "lat": "26.8", "lng": "80.9", "sequence": 1},
            {"route_name": "Route A", "stop_name": "Duplicate", "lat": "0", "lng": "0", "sequence": 1},
            {"route_name": "Route A", "stop_name": "Drop", "lat": "26.9", "lng": "81.0", "sequence": 1},
        ]

        routes, _, errors, _ = normalize_import_records(rows)

        self.assertEqual(routes, {})
        self.assertTrue(any("invalid or outside valid bounds" in item["reason"] for item in errors))
        self.assertTrue(any("sequence contains duplicates" in item["reason"] for item in errors))

    def test_geojson_requires_matching_line_string_with_real_coordinates(self):
        payload = {
            "type": "FeatureCollection",
            "features": [{
                "type": "Feature",
                "properties": {"route_code": "A1"},
                "geometry": {"type": "LineString", "coordinates": [[80.9, 26.8], [81.0, 26.9]]},
            }],
        }

        geometries, errors = parse_geojson_routes(json.dumps(payload).encode())

        self.assertEqual(geometries[("code", "a1")], [(80.9, 26.8), (81.0, 26.9)])
        self.assertEqual(errors, [])

    @staticmethod
    def noida_row(route_id, direction_id, sequence, stop_id, stop_name, lat=28.57, lng=77.32):
        return {
            "city_id": "noida",
            "route_id": route_id,
            "route_name": f"Route {route_id}",
            "route_number": "N-1",
            "direction_id": direction_id,
            "stop_sequence": sequence,
            "stop_id": stop_id,
            "stop_name": stop_name,
            "latitude": lat,
            "longitude": lng,
        }

    def test_noida_route_rows_group_by_city_route_direction_and_sort_sequence(self):
        rows = [
            self.noida_row("R1", "in", 2, "S2", "Second", 28.572, 77.322),
            self.noida_row("R1", "out", 1, "S1", "First", 28.57, 77.32),
            self.noida_row("R1", "in", 1, "S3", "First reverse", 28.574, 77.324),
            self.noida_row("R1", "out", 2, "S2", "Second", 28.572, 77.322),
        ]

        groups, errors, valid_rows, routes_detected = normalize_noida_route_stop_rows(
            rows, ("noida", "00000000-0000-0000-0000-000000000001"),
        )

        self.assertEqual(routes_detected, 2)
        self.assertEqual(valid_rows, 4)
        self.assertEqual(errors, [])
        self.assertEqual(set(groups), {("noida", "R1", "in"), ("noida", "R1", "out")})
        self.assertEqual([stop["sequence"] for stop in groups[("noida", "R1", "in")]["stops"]], [1, 2])

    def test_noida_invalid_coordinates_and_duplicate_sequence_exclude_entire_direction(self):
        rows = [
            self.noida_row("R1", "out", 1, "S1", "First"),
            self.noida_row("R1", "out", 1, "S2", "Second", 28.58, 77.33),
            self.noida_row("R2", "out", 1, "S3", "First R2", 0, 0),
            self.noida_row("R2", "out", 2, "S4", "Second R2", 28.58, 77.33),
        ]

        groups, errors, valid_rows, _ = normalize_noida_route_stop_rows(rows, ("noida",))

        self.assertEqual(groups, {})
        self.assertEqual(valid_rows, 0)
        self.assertTrue(any("duplicate stop_sequence" in item["reason"] for item in errors))
        self.assertTrue(any("latitude/longitude" in item["reason"] for item in errors))

    def test_noida_rows_reject_other_city_and_malformed_required_headers(self):
        row = self.noida_row("R1", "out", 1, "S1", "First")
        row["city_id"] = "lucknow"
        groups, errors, valid_rows, _ = normalize_noida_route_stop_rows([row], ("noida",))

        self.assertEqual(groups, {})
        self.assertEqual(valid_rows, 0)
        self.assertTrue(any("selected Noida city" in item["reason"] for item in errors))
        with self.assertRaisesRegex(ValueError, "Missing required columns: longitude"):
            normalize_noida_route_stop_rows([{key: value for key, value in row.items() if key != "longitude"}], ("noida",))


if __name__ == "__main__":
    unittest.main()
