"""
Bulk stop CSV import.

Covers the parsing/validation contract that the admin UI depends on: which rows
land, which are skipped as duplicates, and which are reported as invalid.
"""

import csv
import io

from django.contrib.gis.geos import LineString
from django.test import TestCase, override_settings

from transport.models import City, Route, Stop
from transport.services import stop_import_service as svc


def csv_bytes(header, rows):
    """Build CSV text so the tests read as data, not as string juggling."""
    buffer = io.StringIO()
    writer = csv.writer(buffer)
    writer.writerow(header)
    writer.writerows(rows)
    return buffer.getvalue().encode("utf-8")


def make_route(name="LKO-01", code="LKO-01", city=None):
    # Route.path and Route.city are both NOT NULL: a route is a real road line
    # owned by a city, so an import test still has to give it plausible values.
    # get_or_create because City.name is unique and setUp already made Lucknow.
    city = city or City.objects.get_or_create(name="Lucknow")[0]
    return Route.objects.create(
        name=name,
        route_code=code,
        city=city,
        path=LineString((80.94, 26.85), (80.95, 26.86)),
    )


class ParseHeaderTests(TestCase):
    def test_canonical_headers(self):
        canonical = svc.parse_header(["name", "lat", "lon"])
        self.assertEqual(
            sorted(canonical.values()), ["lat", "lon", "name"]
        )

    def test_accepts_spreadsheet_aliases_and_case(self):
        canonical = svc.parse_header(
            ["Stop Name", "LATITUDE", "Longitude", "Sequence", "Landmark"]
        )
        self.assertEqual(sorted(canonical.values()), [
            "lat", "lon", "name", "nearby_landmark", "order",
        ])

    def test_missing_required_column_is_rejected(self):
        with self.assertRaises(svc.RowError) as ctx:
            svc.parse_header(["name", "latitude"])
        self.assertIn("lon", str(ctx.exception))

    def test_no_header_is_rejected(self):
        with self.assertRaises(svc.RowError):
            svc.parse_header([])

    def test_bom_prefixed_header_still_matches(self):
        # Spreadsheet exports add a BOM; without stripping it the first column
        # becomes "﻿name" and the whole file is rejected.
        canonical = svc.parse_header(["\ufeffname", "lat", "lon"])
        self.assertIn("name", canonical.values())


class LoadRowsTests(TestCase):
    def test_parses_valid_rows(self):
        rows, errors = svc.load_rows("name,lat,lon\nHazratganj,26.85,80.94\n")
        self.assertEqual(errors, [])
        self.assertEqual(len(rows), 1)
        self.assertEqual(rows[0]["name"], "Hazratganj")
        self.assertEqual(rows[0]["lat"], 26.85)
        # Row 2 in the file: header is row 1.
        self.assertEqual(rows[0]["row"], 2)

    def test_bad_row_does_not_stop_the_file(self):
        rows, errors = svc.load_rows(
            "name,lat,lon\n"
            "Good,26.85,80.94\n"
            "Bad,not-a-number,80.94\n"
            "AlsoGood,26.86,80.95\n"
        )
        self.assertEqual(len(rows), 2)
        self.assertEqual(len(errors), 1)
        # The error carries the file row number, header included, so the admin
        # can find it in the spreadsheet.
        self.assertEqual(errors[0]["row"], 3)
        self.assertIn("lat", errors[0]["error"])

    def test_out_of_range_coordinates_rejected(self):
        _, errors = svc.load_rows("name,lat,lon\nBad,999,80.94\n")
        self.assertIn("outside", errors[0]["error"])

    def test_blank_and_nan_coordinates_rejected(self):
        _, errors = svc.load_rows("name,lat,lon\nA,,80.9\nB,nan,80.9\nC,inf,80.9\n")
        self.assertEqual(len(errors), 3)

    def test_missing_name_rejected(self):
        _, errors = svc.load_rows("name,lat,lon\n,26.85,80.94\n")
        self.assertIn("name", errors[0]["error"])

    def test_missing_header_reports_without_rows(self):
        rows, errors = svc.load_rows("stop,latitude\nA,1\n")
        self.assertEqual(rows, [])
        self.assertIn("lon", errors[0]["error"])

    def test_empty_file_raises(self):
        with self.assertRaises(svc.RowError):
            svc.load_rows("   ")

    def test_negative_order_rejected(self):
        _, errors = svc.load_rows("name,lat,lon,order\nA,26.8,80.9,-1\n")
        self.assertIn("negative", errors[0]["error"])

    def test_row_limit_enforced(self):
        header = "name,lat,lon"
        body = "".join(f"S{i},26.8,80.9\n" for i in range(svc.MAX_ROWS + 1))
        with self.assertRaises(svc.RowError) as ctx:
            svc.bulk_import(header + "\n" + body)
        self.assertIn("limit", str(ctx.exception))


@override_settings(DEBUG=False)
class BulkImportTests(TestCase):
    def setUp(self):
        self.city = City.objects.create(name="Lucknow")

    def test_global_stops_created_without_route_column(self):
        summary, created = svc.bulk_import(
            "name,lat,lon\nHazratganj,26.85,80.94\nGomti Nagar,26.86,80.95\n"
        )
        self.assertEqual(summary["created"], 2)
        self.assertEqual(Stop.objects.count(), 2)
        # No route means global, and is_global must agree.
        for stop in Stop.objects.all():
            self.assertTrue(stop.is_global)
            self.assertIsNone(stop.route)
        self.assertEqual(len(created), 2)

    def test_city_is_attached(self):
        svc.bulk_import(f"name,lat,lon,city\nHazratganj,26.85,80.94,{self.city.name}\n")
        self.assertEqual(Stop.objects.get().city, self.city)

    def test_unknown_city_is_reported_and_row_skipped(self):
        summary, _ = svc.bulk_import("name,lat,lon,city\nA,26.85,80.94,Nowhere\n")
        self.assertEqual(summary["created"], 0)
        self.assertEqual(summary["invalid"], 1)
        self.assertEqual(Stop.objects.count(), 0)
        self.assertIn("Nowhere", summary["errors"][0]["error"])

    def test_route_stops_created_and_ordered(self):
        route = make_route()
        summary, _ = svc.bulk_import(
            "name,lat,lon,route,order\n"
            "Second,26.86,80.95,LKO-01,2\n"
            "First,26.85,80.94,LKO-01,1\n"
        )
        self.assertEqual(summary["created"], 2)
        self.assertEqual(Stop.objects.filter(route=route).count(), 2)
        for stop in Stop.objects.all():
            self.assertFalse(stop.is_global)
        first = Stop.objects.get(name="First")
        self.assertEqual(first.order, 1)

    def test_route_matched_by_name_or_code(self):
        make_route(name="City Circle", code="CC-9")
        # Both rows resolve to the same route, so they need distinct orders:
        # two stops at order 0 would break the (route, order) unique constraint.
        summary, _ = svc.bulk_import(
            "name,lat,lon,route,order\n"
            "ByName,26.85,80.94,City Circle,1\n"
            "ByCode,26.86,80.95,CC-9,2\n"
        )
        self.assertEqual(summary["created"], 2)
        self.assertEqual(Stop.objects.filter(route__isnull=False).count(), 2)

    def test_unknown_route_is_an_error_not_a_global_stop(self):
        # Silently creating a global stop here would be worse than failing: the
        # admin asked for a route stop and would not get one.
        summary, _ = svc.bulk_import("name,lat,lon,route\nA,26.85,80.94,Ghost\n")
        self.assertEqual(summary["created"], 0)
        self.assertEqual(summary["invalid"], 1)
        self.assertEqual(Stop.objects.count(), 0)
        self.assertIn("Ghost", summary["errors"][0]["error"])

    def test_duplicate_against_database_is_skipped(self):
        svc.bulk_import("name,lat,lon\nHazratganj,26.85,80.94\n")
        summary, created = svc.bulk_import("name,lat,lon\nHazratganj,26.85,80.94\n")
        self.assertEqual(summary["created"], 0)
        self.assertEqual(summary["duplicate"], 1)
        self.assertEqual(created, [])
        self.assertEqual(Stop.objects.count(), 1)

    def test_duplicate_within_the_same_file_is_skipped(self):
        summary, _ = svc.bulk_import(
            "name,lat,lon\nSame,26.85,80.94\nSame,26.85,80.94\n"
        )
        self.assertEqual(summary["created"], 1)
        self.assertEqual(summary["duplicate"], 1)
        self.assertEqual(Stop.objects.count(), 1)

    def test_same_name_different_place_is_not_a_duplicate(self):
        summary, _ = svc.bulk_import(
            "name,lat,lon\nMarket,26.85,80.94\nMarket,26.90,80.99\n"
        )
        self.assertEqual(summary["created"], 2)

    def test_conflicting_order_on_one_route_is_skipped(self):
        # The (route, order) unique constraint would otherwise raise mid-file
        # and roll the whole import back.
        make_route()
        summary, _ = svc.bulk_import(
            "name,lat,lon,route,order\n"
            "A,26.85,80.94,LKO-01,1\n"
            "B,26.86,80.95,LKO-01,1\n"
        )
        self.assertEqual(summary["created"], 1)
        self.assertEqual(summary["duplicate"], 1)
        self.assertEqual(Stop.objects.count(), 1)

    def test_valid_rows_land_even_when_others_fail(self):
        make_route()
        summary, _ = svc.bulk_import(
            "name,lat,lon,route\n"
            "Good,26.85,80.94,LKO-01\n"
            "BadRoute,26.86,80.95,Ghost\n"
            "AlsoGood,26.87,80.96,\n"
        )
        self.assertEqual(summary["created"], 2)
        self.assertEqual(summary["invalid"], 1)
        self.assertEqual(Stop.objects.count(), 2)

    def test_dry_run_reports_without_writing(self):
        summary, _ = svc.bulk_import(
            "name,lat,lon\nHazratganj,26.85,80.94\n", dry_run=True
        )
        self.assertEqual(summary["created"], 1)
        self.assertEqual(Stop.objects.count(), 0)

    def test_coordinates_land_in_right_place(self):
        svc.bulk_import("name,lat,lon\nHazratganj,26.85,80.94\n")
        stop = Stop.objects.get()
        self.assertAlmostEqual(stop.location.y, 26.85, places=5)
        self.assertAlmostEqual(stop.location.x, 80.94, places=5)

    def test_nearby_landmark_persisted(self):
        svc.bulk_import("name,lat,lon,landmark\nA,26.85,80.94,Clock Tower\n")
        self.assertEqual(Stop.objects.get().nearby_landmark, "Clock Tower")

    def test_bom_encoded_file_imports(self):
        text = "\ufeffname,lat,lon\nHazratganj,26.85,80.94\n"
        summary, _ = svc.bulk_import(text)
        self.assertEqual(summary["created"], 1)