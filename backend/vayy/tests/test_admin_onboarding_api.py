"""Database-backed tests for Dynamic Routing's Dry Run and Apply API."""

import json
import csv
import io
from unittest.mock import patch
from openpyxl import Workbook

from django.core.files.uploadedfile import SimpleUploadedFile
from django.contrib.gis.geos import LineString, Point
from django.contrib.gis.measure import D
from django.test import TestCase
from rest_framework.test import APIClient

from accounts.models import User
from transport.models import City, CityAdminConfiguration, Route, RouteStopAssociation, Stop
from transport.api.dynamic_admin_views import _corridor_preview_payload
from transport.services.route_search_service import RouteSearchService


class RouteSearchAssociationTests(TestCase):
    def setUp(self):
        self.city = City.objects.create(name="Route Search City")
        self.origin = Point(80.9, 26.8, srid=4326)
        self.destination = Point(80.9, 26.9, srid=4326)

    def make_route(self, name="Route", is_public=True):
        return Route.objects.create(
            city=self.city,
            name=name,
            path=LineString([(80.9, 26.8), (80.9, 26.9)], srid=4326),
            is_public=is_public,
        )

    def make_stop(self, route, name, point, order, **flags):
        return Stop.objects.create(
            route=route,
            city=self.city,
            name=name,
            location=point,
            order=order,
            coordinate_status="verified",
            **flags,
        )

    def search(self, city_id=None):
        return RouteSearchService._find_candidate_pairs(
            self.origin, self.destination, D(m=250), city_id=city_id or self.city.id,
        )

    def test_matches_verified_public_stops_in_forward_order(self):
        route = self.make_route()
        self.make_stop(route, "Pickup", self.origin, 1)
        self.make_stop(route, "Destination", self.destination, 2)

        self.assertEqual([str(item["route_id"]) for item in self.search()], [str(route.id)])

    def test_rejects_destination_before_pickup_and_private_routes(self):
        reverse = self.make_route("Reverse direction")
        self.make_stop(reverse, "Destination", self.destination, 1)
        self.make_stop(reverse, "Pickup", self.origin, 2)
        private = self.make_route("Private route", is_public=False)
        self.make_stop(private, "Pickup", self.origin, 1)
        self.make_stop(private, "Destination", self.destination, 2)

        self.assertEqual(self.search(), [])

    def test_respects_pickup_and_alighting_eligibility(self):
        no_boarding = self.make_route("No boarding")
        self.make_stop(no_boarding, "Pickup", self.origin, 1, boarding_allowed=False)
        self.make_stop(no_boarding, "Destination", self.destination, 2)
        no_alighting = self.make_route("No alighting")
        self.make_stop(no_alighting, "Pickup", self.origin, 1)
        self.make_stop(no_alighting, "Destination", self.destination, 2, alighting_allowed=False)

        self.assertEqual(self.search(), [])

    def test_global_stops_without_route_associations_do_not_match(self):
        Stop.objects.create(
            city=self.city, name="Unassociated pickup", location=self.origin, order=1,
        )
        Stop.objects.create(
            city=self.city, name="Unassociated destination", location=self.destination, order=2,
        )

        self.assertEqual(self.search(), [])


class DynamicRouteCityResolutionTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            email="route-city-passenger@example.test",
            password="test-password",
            role="passenger",
        )
        self.client = APIClient()
        self.client.force_authenticate(user=self.user)

    def test_preview_uses_canonical_city_resolution_when_client_omits_city_id(self):
        city = City.objects.create(
            name="Lucknow",
            state="Uttar Pradesh",
            location=Point(80.9462, 26.8467, srid=4326),
        )

        with patch(
            "transport.api.dynamic_admin_views._corridor_preview_payload",
            return_value=({"routes": [], "city": {"id": str(city.id), "name": city.name}}, None),
        ):
            response = self.client.post("/api/transport/routes/dynamic-preview/", {
                "origin": {"lat": 26.7435744, "lng": 80.9451722},
                "destination": {"lat": 26.9363415, "lng": 80.8980289},
                "vehicle_type": "auto",
            }, format="json")

        self.assertEqual(response.status_code, 200, response.data)
        self.assertEqual(response.data["data"]["city"]["id"], str(city.id))
        self.assertEqual(response.data["data"]["routes"], [])

    def test_preview_resolves_lucknow_when_database_centroid_is_missing(self):
        city = City.objects.create(name="Lucknow", state="Uttar Pradesh")
        CityAdminConfiguration.objects.create(city=city, is_active=True)
        City.objects.create(name="Other City", location=Point(77.209, 28.6139, srid=4326))
        Stop.objects.create(
            city=city, name="Existing global pickup",
            location=Point(80.9451722, 26.7435744, srid=4326),
            coordinate_status="provisional",
        )

        with patch(
            "transport.api.dynamic_admin_views._corridor_preview_payload",
            return_value=({"routes": [], "city": {"id": str(city.id), "name": city.name}}, None),
        ):
            response = self.client.post("/api/transport/routes/dynamic-preview/", {
                "origin": {"lat": 26.7435744, "lng": 80.9451722},
                "destination": {"lat": 26.9363415, "lng": 80.8980289},
                "vehicle_type": "auto",
            }, format="json")

        self.assertEqual(response.status_code, 200, response.data)
        self.assertEqual(response.data["data"]["city"]["id"], str(city.id))

    def test_preview_returns_empty_routes_when_stops_have_no_route_associations(self):
        city = City.objects.create(
            name="Lucknow",
            state="Uttar Pradesh",
            location=Point(80.9462, 26.8467, srid=4326),
        )
        CityAdminConfiguration.objects.create(city=city, is_active=True)
        Stop.objects.create(
            city=city,
            name="Unassociated pickup",
            location=Point(80.9451722, 26.7435744, srid=4326),
            coordinate_status="provisional",
        )
        Stop.objects.create(
            city=city,
            name="Unassociated destination",
            location=Point(80.8980289, 26.9363415, srid=4326),
            coordinate_status="provisional",
        )

        response = self.client.post("/api/transport/routes/dynamic-preview/", {
            "origin": {"lat": 26.7435744, "lng": 80.9451722},
            "destination": {"lat": 26.9363415, "lng": 80.8980289},
            "vehicle_type": "auto",
        }, format="json")

        self.assertEqual(response.status_code, 200, response.data)
        self.assertTrue(response.data["success"])
        self.assertEqual(response.data["data"]["city"]["id"], str(city.id))
        self.assertEqual(response.data["data"]["routes"], [])

    def test_preview_does_not_assign_canonical_city_outside_existing_fallback_radius(self):
        city = City.objects.create(name="Lucknow", state="Uttar Pradesh")
        CityAdminConfiguration.objects.create(city=city, is_active=True)

        response = self.client.post("/api/transport/routes/dynamic-preview/", {
            "origin": {"lat": 23.0, "lng": 80.0},
            "destination": {"lat": 23.1, "lng": 80.0},
            "vehicle_type": "auto",
        }, format="json")

        self.assertEqual(response.status_code, 400)
        self.assertIn("Unable to determine a service city", str(response.data))


class AdminOnboardingAPITests(TestCase):
    url = "/api/transport/admin/onboarding/"

    def setUp(self):
        self.user = User.objects.create_user(
            email="import-admin@example.test",
            password="test-password",
            role="admin",
        )
        self.client = APIClient()
        self.client.force_authenticate(user=self.user)

    @staticmethod
    def fake_road_path_through(*coordinates):
        return {
            "distance": 2400,
            "duration": 600,
            "geometry": {"type": "LineString", "coordinates": [list(point) for point in coordinates]},
        }

    def apply_after_dry_run(self, payload):
        dry_payload = dict(payload)
        dry_payload["mode"] = "validate"
        for value in dry_payload.values():
            if hasattr(value, "seek"):
                value.seek(0)
        dry_run = self.client.post(self.url, dry_payload, format="multipart")
        self.assertEqual(dry_run.status_code, 200, dry_run.data)
        token = dry_run.data["data"].get("apply_token")
        self.assertTrue(token, dry_run.data)
        for value in payload.values():
            if hasattr(value, "seek"):
                value.seek(0)
        apply_payload = dict(payload)
        apply_payload["mode"] = "apply"
        apply_payload["apply_token"] = token
        return self.client.post(self.url, apply_payload, format="multipart")

    def test_preview_rejects_corridor_that_requires_a_transfer(self):
        city = City.objects.create(name="Preview City", state="Uttar Pradesh")
        route = Route.objects.create(
            city=city,
            name="Approved Route",
            route_code="R-1",
            path=LineString([(80.9, 26.8), (81.0, 26.9)], srid=4326),
            is_public=True,
        )
        Stop.objects.create(
            route=route,
            city=city,
            name="Verified Stop",
            location=Point(80.9, 26.8, srid=4326),
            order=1,
            coordinate_status="verified",
        )
        transfer_path = {
            "stops": [{"id": "s1", "route_id": str(route.id), "order": 1}],
            "first_mile_walk_meters": 0,
            "last_mile_walk_meters": 0,
            "transfer_count": 1,
        }
        with patch("transport.api.dynamic_admin_views.RouteSearchService.search_routes", return_value=[]), patch(
            "transport.api.dynamic_admin_views.find_stop_corridor",
            return_value=transfer_path,
        ):
            payload, error = _corridor_preview_payload(
                city,
                {"lat": 26.8, "lng": 80.9},
                {"lat": 26.9, "lng": 81.0},
                "bike",
            )

        self.assertIsNone(error)
        self.assertEqual(payload["routes"], [])

    @staticmethod
    def route_upload(mode):
        stops = [
            {"name": "Pickup", "lat": 26.8, "lng": 80.9, "sequence": 1},
            {"name": "Drop", "lat": 26.9, "lng": 81.0, "sequence": 2},
        ]
        csv_buffer = io.StringIO(newline="")
        writer = csv.writer(csv_buffer)
        writer.writerow(["route_name", "route_code", "stops_ordered", "name", "latitude", "longitude"])
        writer.writerow(["Pilot Route", "P-1", json.dumps(stops), "", "", ""])
        writer.writerow(["", "", "", "Pickup", 26.8, 80.9])
        writer.writerow(["", "", "", "Drop", 26.9, 81.0])
        csv_content = csv_buffer.getvalue().encode()
        geojson = {
            "type": "FeatureCollection",
            "features": [{
                "type": "Feature",
                "properties": {"route_code": "P-1", "route_name": "Pilot Route"},
                "geometry": {"type": "LineString", "coordinates": [[80.9, 26.8], [81.0, 26.9]]},
            }],
        }
        return {
            "file": SimpleUploadedFile("routes.csv", csv_content, content_type="text/csv"),
            "geometry_file": SimpleUploadedFile(
                "routes.geojson", json.dumps(geojson).encode(), content_type="application/geo+json"
            ),
            "city_name": "Pilot City",
            "mode": mode,
        }

    def test_dry_run_parses_route_and_source_geometry_without_writing(self):
        response = self.client.post(self.url, self.route_upload("validate"), format="multipart")

        self.assertEqual(response.status_code, 200, response.data)
        self.assertEqual(response.data["data"]["report"]["routes"], 1)
        self.assertEqual(response.data["data"]["report"]["stop_instances"], 2)
        self.assertFalse(response.data["data"]["applied"])
        self.assertEqual(City.objects.count(), 0)
        self.assertEqual(Route.objects.count(), 0)
        self.assertEqual(Stop.objects.count(), 0)

    def test_apply_imports_private_route_with_existing_global_stop_memberships(self):
        response = self.apply_after_dry_run(self.route_upload("apply"))

        self.assertEqual(response.status_code, 201, response.data)
        route = Route.objects.get(route_code="P-1")
        self.assertFalse(route.is_public)
        memberships = list(route.route_stop_associations.select_related("stop").order_by("order"))
        self.assertEqual([item.stop.name for item in memberships], ["Pickup", "Drop"])
        self.assertEqual([item.order for item in memberships], [1, 2])
        self.assertEqual(route.stops.count(), 0)
        self.assertTrue(all(item.stop.is_global for item in memberships))
        self.assertTrue(all(item.stop.coordinate_status == "provisional" for item in memberships))

    def test_route_apply_without_source_geometry_is_rejected(self):
        payload = self.route_upload("apply")
        payload.pop("geometry_file")

        response = self.client.post(self.url, payload, format="multipart")

        self.assertEqual(response.status_code, 422, response.data)
        self.assertIn("source GeoJSON geometry", response.data["message"])
        self.assertEqual(City.objects.count(), 0)
        self.assertEqual(Route.objects.count(), 0)

    def test_repeated_apply_is_idempotent_for_route_and_stop_records(self):
        self.assertEqual(self.apply_after_dry_run(self.route_upload("apply")).status_code, 201)

        response = self.apply_after_dry_run(self.route_upload("apply"))

        self.assertEqual(response.status_code, 201, response.data)
        self.assertEqual(Route.objects.count(), 1)
        self.assertEqual(Stop.objects.count(), 2)
        self.assertEqual(RouteStopAssociation.objects.count(), 2)
        self.assertEqual(response.data["data"]["created"], 0)
        self.assertEqual(response.data["data"]["duplicates"], 2)

    def test_flat_stop_csv_creates_only_provisional_global_stops(self):
        payload = {
            "file": SimpleUploadedFile(
                "stops.csv",
                b"stop_name,lat,lng\nStation A,26.8,80.9\nStation B,26.9,81.0\n",
                content_type="text/csv",
            ),
            "city_name": "Pilot City",
            "mode": "apply",
        }

        response = self.apply_after_dry_run(payload)

        self.assertEqual(response.status_code, 201, response.data)
        self.assertEqual(Route.objects.count(), 0)
        self.assertEqual(Stop.objects.count(), 2)
        self.assertTrue(all(stop.is_global for stop in Stop.objects.all()))
        self.assertTrue(all(stop.coordinate_status == "provisional" for stop in Stop.objects.all()))

    @staticmethod
    def master_rows():
        def row(city, route, direction, sequence, stop_id, name, lat, lng, geom_id):
            return [
                "1", city, city.title(), route, "10", "Demo Route", direction,
                direction.title(), str(sequence), stop_id, name, "[]", str(lat),
                str(lng), "true", "true", geom_id, "fixture", f"fixture:{city}:{stop_id}",
            ]

        rows = [
            row("lucknow", "R1", "out", 1, "L1", "Lko A", 26.1, 80.1, "lko-r1"),
            row("lucknow", "R1", "out", 2, "L2", "Lko B", 26.2, 80.2, "lko-r1"),
            row("lucknow", "R1", "in", 1, "L2", "Lko B", 26.2, 80.2, "lko-r1"),
            row("lucknow", "R1", "in", 2, "L1", "Lko A", 26.1, 80.1, "lko-r1"),
            row("noida", "R1", "out", 1, "N1", "Noida A", 28.1, 77.1, "noi-r1-out"),
            row("noida", "R1", "out", 2, "N2", "Noida B", 28.2, 77.2, "noi-r1-out"),
        ]
        rows[0][11] = '["Local Alias A"]'
        rows[0][14] = "false"
        return rows

    @staticmethod
    def master_geojson():
        def feature(city, route, direction, geom_id, coords):
            return {
                "type": "Feature",
                "properties": {
                    "city_id": city,
                    "route_id": route,
                    "direction_id": direction,
                    "route_geometry_id": geom_id,
                },
                "geometry": {"type": "LineString", "coordinates": coords},
            }

        return {
            "type": "FeatureCollection",
            "features": [
                feature("lucknow", "R1", "", "lko-r1", [[80.1, 26.1], [80.2, 26.2]]),
                feature("noida", "R1", "", "noi-r1-out", [[77.1, 28.1], [77.2, 28.2]]),
            ],
        }

    def master_upload(self, city_slug, *, mode="validate", rows=None, geojson=None):
        csv_buffer = io.StringIO(newline="")
        writer = csv.writer(csv_buffer)
        writer.writerow([
            "schema_version", "city_id", "city_name", "route_id", "route_number",
            "route_name", "direction_id", "direction_name", "stop_sequence",
            "stop_id", "stop_name", "stop_aliases_json", "latitude", "longitude",
            "boarding_allowed", "alighting_allowed", "route_geometry_id",
            "source_name", "source_reference",
        ])
        writer.writerows(rows if rows is not None else self.master_rows())
        geometry = geojson if geojson is not None else self.master_geojson()
        return {
            "file": SimpleUploadedFile("master.csv", csv_buffer.getvalue().encode(), content_type="text/csv"),
            "geometry_file": SimpleUploadedFile("master.geojson", json.dumps(geometry).encode(), content_type="application/geo+json"),
            "city_slug": city_slug,
            "mode": mode,
        }

    def create_master_global_stops(self):
        cities = {city.slug: city for city in City.objects.all()}
        created = set()
        for row in self.master_rows():
            city_slug, stop_id = row[1], row[9]
            key = (city_slug, stop_id)
            if city_slug not in cities or key in created:
                continue
            created.add(key)
            Stop.objects.create(
                city=cities[city_slug], name=row[10], aliases=json.loads(row[11]),
                source_stop_id=stop_id,
                location=Point(float(row[13]), float(row[12]), srid=4326),
                coordinate_status="provisional",
                boarding_allowed=row[14] == "true", alighting_allowed=row[15] == "true",
            )

    def test_master_dry_run_filters_city_without_writes_and_separates_directions(self):
        City.objects.create(name="Lucknow")
        City.objects.create(name="Noida")
        self.create_master_global_stops()

        response = self.client.post(self.url, self.master_upload("lucknow"), format="multipart")

        self.assertEqual(response.status_code, 200, response.data)
        report = response.data["data"]
        self.assertTrue(report["can_apply"])
        self.assertEqual(report["report"]["routes"], 2)
        self.assertEqual(report["report"]["selected_city_rows"], 4)
        self.assertEqual(report["report"]["excluded_city_rows"], 2)
        self.assertEqual(City.objects.get(slug="lucknow").routes.count(), 0)
        self.assertEqual(Route.objects.count(), 0)
        self.assertEqual(Stop.objects.count(), 4)
        self.assertEqual(report["report"]["global_stop_memberships"], 4)
        self.assertEqual(report["report"]["stop_instances"], 0)

    def test_master_headers_without_schema_version_get_clear_error(self):
        payload = self.master_upload("lucknow")
        csv_bytes = payload["file"].read().replace(b"schema_version,", b"", 1)
        payload["file"] = SimpleUploadedFile("master.csv", csv_bytes, content_type="text/csv")

        response = self.client.post(self.url, payload, format="multipart")

        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.data["code"], "MASTER_SCHEMA_VERSION_REQUIRED")
        self.assertIn("schema_version=1", response.data["message"])

    def test_master_apply_preserves_identity_metadata_and_city_qualified_geometry(self):
        City.objects.create(name="Lucknow")
        City.objects.create(name="Noida")
        self.create_master_global_stops()

        lucknow_response = self.apply_after_dry_run(self.master_upload("lucknow", mode="apply"))
        self.assertEqual(lucknow_response.status_code, 201, lucknow_response.data)
        lucknow_routes = list(Route.objects.filter(city__slug="lucknow").order_by("source_direction_id"))
        self.assertEqual(len(lucknow_routes), 2)
        self.assertEqual({route.source_route_id for route in lucknow_routes}, {"R1"})
        self.assertEqual({route.source_direction_id for route in lucknow_routes}, {"in", "out"})
        self.assertEqual({route.route_number for route in lucknow_routes}, {"10"})
        self.assertTrue(all(not route.is_public for route in lucknow_routes))
        self.assertEqual(lucknow_routes[0].route_geometry_id, "lko-r1")
        self.assertEqual(list(lucknow_routes[0].route_stop_associations.order_by("order").values_list("stop__source_stop_id", flat=True)), ["L2", "L1"])
        self.assertEqual(Stop.objects.filter(city__slug="lucknow", coordinate_status="provisional").count(), 2)
        self.assertEqual(Stop.objects.filter(city__slug="lucknow", source_stop_id="L2").count(), 1)
        outbound = Route.objects.get(city__slug="lucknow", source_direction_id="out")
        imported_stop = outbound.route_stop_associations.get(stop__source_stop_id="L1")
        self.assertEqual(imported_stop.stop.aliases, ["Local Alias A"])
        self.assertFalse(imported_stop.boarding_allowed)
        self.assertEqual(imported_stop.stop.source_reference, "")
        self.assertEqual(Stop.objects.filter(route__isnull=False, route__city__slug="lucknow").count(), 0)

        noida_response = self.apply_after_dry_run(self.master_upload("noida", mode="apply"))
        self.assertEqual(noida_response.status_code, 201, noida_response.data)
        noida_route = Route.objects.get(city__slug="noida")
        self.assertEqual(noida_route.route_geometry_id, "noi-r1-out")
        self.assertAlmostEqual(noida_route.path.coords[0][0], 77.1)
        self.assertEqual(Route.objects.count(), 3)
        self.assertEqual(RouteStopAssociation.objects.filter(route__city__slug="noida").count(), 2)

    def test_master_invalid_selected_city_row_blocks_apply(self):
        City.objects.create(name="Lucknow")
        self.create_master_global_stops()
        rows = self.master_rows()
        rows[1][8] = "1"  # Duplicate sequence in selected Lucknow direction.
        payload = self.master_upload("lucknow", rows=rows)

        dry_run = self.client.post(self.url, payload, format="multipart")
        self.assertEqual(dry_run.status_code, 200, dry_run.data)
        self.assertFalse(dry_run.data["data"]["can_apply"])
        self.assertTrue(any("duplicate stop_sequence" in item["reason"] for item in dry_run.data["data"]["blocking_errors"]))

        payload["file"].seek(0)
        payload["geometry_file"].seek(0)
        payload["mode"] = "apply"
        response = self.client.post(self.url, payload, format="multipart")
        self.assertEqual(response.status_code, 422, response.data)
        self.assertEqual(Route.objects.count(), 0)

    def test_master_apply_requires_matching_dry_run_token(self):
        City.objects.create(name="Lucknow")
        self.create_master_global_stops()
        payload = self.master_upload("lucknow")
        dry_run = self.client.post(self.url, payload, format="multipart")
        payload["file"].seek(0)
        payload["geometry_file"].seek(0)
        payload["mode"] = "apply"
        payload["apply_token"] = dry_run.data["data"]["apply_token"]
        rows = self.master_rows()
        rows[0][18] = "changed-after-dry-run"
        changed = self.master_upload("lucknow", mode="apply", rows=rows)
        changed["apply_token"] = payload["apply_token"]

        response = self.client.post(self.url, changed, format="multipart")

        self.assertEqual(response.status_code, 409, response.data)
        self.assertEqual(Route.objects.count(), 0)

    def test_master_apply_rolls_back_database_failure(self):
        City.objects.create(name="Lucknow")
        self.create_master_global_stops()
        payload = self.master_upload("lucknow", mode="validate")
        dry_run = self.client.post(self.url, payload, format="multipart")
        payload["file"].seek(0)
        payload["geometry_file"].seek(0)
        payload["mode"] = "apply"
        payload["apply_token"] = dry_run.data["data"]["apply_token"]
        with patch.object(Route, "save", side_effect=RuntimeError("injected failure")):
            response = self.client.post(self.url, payload, format="multipart")

        self.assertEqual(response.status_code, 500)
        self.assertEqual(Route.objects.count(), 0)
        self.assertEqual(Stop.objects.count(), 2)

    def test_master_repeated_apply_is_idempotent(self):
        City.objects.create(name="Lucknow")
        self.create_master_global_stops()
        payload = self.master_upload("lucknow", mode="apply")
        self.assertEqual(self.apply_after_dry_run(payload).status_code, 201)
        first_counts = (Route.objects.count(), Stop.objects.count(), RouteStopAssociation.objects.count())

        repeated = self.apply_after_dry_run(self.master_upload("lucknow", mode="apply"))

        self.assertEqual(repeated.status_code, 201, repeated.data)
        self.assertEqual((Route.objects.count(), Stop.objects.count(), RouteStopAssociation.objects.count()), first_counts)
        self.assertEqual(repeated.data["data"]["report"]["stops_created"], 0)
        self.assertEqual(repeated.data["data"]["report"]["global_stop_memberships_created"], 4)

    @staticmethod
    def noida_rows():
        return [
            {"city_id": "noida", "route_id": "N-ROUTE-1", "route_name": "Sector 51 to Botanical Garden",
             "route_number": "N-1", "direction_id": "out", "stop_sequence": 1, "stop_id": "N1-S1",
             "stop_name": "Sector 51", "latitude": 28.5700, "longitude": 77.3260},
            {"city_id": "noida", "route_id": "N-ROUTE-1", "route_name": "Sector 51 to Botanical Garden",
             "route_number": "N-1", "direction_id": "out", "stop_sequence": 2, "stop_id": "N1-S2",
             "stop_name": "Sector 34", "latitude": 28.5710, "longitude": 77.3270},
            {"city_id": "noida", "route_id": "N-ROUTE-1", "route_name": "Sector 51 to Botanical Garden",
             "route_number": "N-1", "direction_id": "out", "stop_sequence": 3, "stop_id": "N1-S3",
             "stop_name": "Botanical Garden", "latitude": 28.5720, "longitude": 77.3280},
            {"city_id": "noida", "route_id": "N-ROUTE-1", "route_name": "Botanical Garden to Sector 51",
             "route_number": "N-1", "direction_id": "in", "stop_sequence": 1, "stop_id": "N1-S3",
             "stop_name": "Botanical Garden", "latitude": 28.5720, "longitude": 77.3280},
            {"city_id": "noida", "route_id": "N-ROUTE-1", "route_name": "Botanical Garden to Sector 51",
             "route_number": "N-1", "direction_id": "in", "stop_sequence": 2, "stop_id": "N1-S2",
             "stop_name": "Sector 34", "latitude": 28.5710, "longitude": 77.3270},
            {"city_id": "noida", "route_id": "N-ROUTE-1", "route_name": "Botanical Garden to Sector 51",
             "route_number": "N-1", "direction_id": "in", "stop_sequence": 3, "stop_id": "N1-S1",
             "stop_name": "Sector 51", "latitude": 28.5700, "longitude": 77.3260},
        ]

    def noida_upload(self, *, rows=None, excel=False):
        rows = rows if rows is not None else self.noida_rows()
        headers = [
            "city_id", "route_id", "route_name", "route_number", "direction_id",
            "stop_sequence", "stop_id", "stop_name", "latitude", "longitude",
        ]
        if excel:
            workbook = Workbook()
            sheet = workbook.active
            sheet.append(headers)
            for row in rows:
                sheet.append([row.get(header) for header in headers])
            content = io.BytesIO()
            workbook.save(content)
            filename, mime = "noida-routes.xlsx", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            data = content.getvalue()
        else:
            output = io.StringIO(newline="")
            writer = csv.DictWriter(output, fieldnames=headers)
            writer.writeheader()
            writer.writerows(rows)
            filename, mime, data = "noida-routes.csv", "text/csv", output.getvalue().encode()
        return {
            "file": SimpleUploadedFile(filename, data, content_type=mime),
            "city_slug": "noida",
            "import_format": "noida_route_stops",
            "mode": "validate",
        }

    def create_noida_global_stops(self, city):
        created = set()
        for item in self.noida_rows():
            if item["stop_id"] in created:
                continue
            created.add(item["stop_id"])
            Stop.objects.create(
                city=city, name=item["stop_name"], source_stop_id=item["stop_id"],
                location=Point(item["longitude"], item["latitude"], srid=4326),
                coordinate_status="provisional",
            )

    def test_noida_csv_preview_and_apply_persists_grouped_ordered_searchable_routes(self):
        city = City.objects.create(name="Noida", state="Uttar Pradesh")
        self.create_noida_global_stops(city)
        payload = self.noida_upload()

        preview = self.client.post(self.url, payload, format="multipart")
        self.assertEqual(preview.status_code, 200, preview.data)
        preview_report = preview.data["data"]["report"]
        self.assertEqual(preview_report["rows"], 6)
        self.assertEqual(preview_report["valid_rows"], 6)
        self.assertEqual(preview_report["invalid_rows"], 0)
        self.assertEqual(preview_report["routes_detected"], 2)
        self.assertEqual(Route.objects.count(), 0)

        with patch("transport.api.dynamic_admin_views.OSRMService.get_road_path_through", side_effect=self.fake_road_path_through):
            result = self.apply_after_dry_run(payload)
        self.assertEqual(result.status_code, 201, result.data)
        routes = list(Route.objects.filter(city=city).order_by("source_direction_id"))
        self.assertEqual(len(routes), 2)
        self.assertEqual({route.source_route_id for route in routes}, {"N-ROUTE-1"})
        self.assertEqual({route.source_direction_id for route in routes}, {"in", "out"})
        self.assertTrue(all(route.is_public for route in routes))
        outbound = Route.objects.get(city=city, source_direction_id="out")
        self.assertEqual(list(outbound.route_stop_associations.order_by("order").values_list("stop__source_stop_id", "order")), [
            ("N1-S1", 1), ("N1-S2", 2), ("N1-S3", 3),
        ])
        self.assertEqual(outbound.stops.count(), 0)
        self.assertEqual(outbound.route_stop_associations.count(), 3)

    def test_noida_excel_import_is_supported(self):
        city = City.objects.create(name="Noida")
        self.create_noida_global_stops(city)
        with patch("transport.api.dynamic_admin_views.OSRMService.get_road_path_through", side_effect=self.fake_road_path_through):
            response = self.apply_after_dry_run(self.noida_upload(excel=True))

        self.assertEqual(response.status_code, 201, response.data)
        self.assertEqual(Route.objects.count(), 2)
        self.assertEqual(Stop.objects.count(), 3)

    def test_noida_invalid_coordinate_is_reported_and_excludes_only_its_direction(self):
        city = City.objects.create(name="Noida")
        self.create_noida_global_stops(city)
        rows = self.noida_rows()
        rows[1]["latitude"] = ""
        payload = self.noida_upload(rows=rows)

        preview = self.client.post(self.url, payload, format="multipart")

        self.assertEqual(preview.status_code, 200, preview.data)
        self.assertEqual(preview.data["data"]["report"]["invalid_rows"], 3)
        self.assertEqual(preview.data["data"]["report"]["routes_valid"], 1)
        self.assertTrue(any("latitude and longitude are required" in item["reason"] for item in preview.data["data"]["errors"]))
        self.assertEqual(Route.objects.count(), 0)

    def test_noida_repeated_import_updates_in_place(self):
        city = City.objects.create(name="Noida")
        self.create_noida_global_stops(city)
        with patch("transport.api.dynamic_admin_views.OSRMService.get_road_path_through", side_effect=self.fake_road_path_through):
            first = self.apply_after_dry_run(self.noida_upload())
            second = self.apply_after_dry_run(self.noida_upload())

        self.assertEqual(first.status_code, 201, first.data)
        self.assertEqual(second.status_code, 201, second.data)
        self.assertEqual(Route.objects.count(), 2)
        self.assertEqual(Stop.objects.count(), 3)
        self.assertEqual(RouteStopAssociation.objects.count(), 6)
        self.assertEqual(second.data["data"]["report"]["routes_created"], 0)
        self.assertEqual(second.data["data"]["report"]["stops_created"], 0)
        self.assertEqual(second.data["data"]["report"]["stops_updated"], 0)

    def test_noida_database_failure_rolls_back_routes_and_stops(self):
        city = City.objects.create(name="Noida")
        self.create_noida_global_stops(city)
        payload = self.noida_upload()
        dry_run = self.client.post(self.url, payload, format="multipart")
        payload["file"].seek(0)
        payload["mode"] = "apply"
        payload["apply_token"] = dry_run.data["data"]["apply_token"]

        with patch("transport.api.dynamic_admin_views.OSRMService.get_road_path_through", side_effect=self.fake_road_path_through), \
             patch.object(Route, "save", side_effect=RuntimeError("injected failure")):
            response = self.client.post(self.url, payload, format="multipart")

        self.assertEqual(response.status_code, 500)
        self.assertEqual(Route.objects.count(), 0)
        self.assertEqual(Stop.objects.count(), 3)

    def test_noida_upload_rejects_other_city_and_duplicate_sequences(self):
        city = City.objects.create(name="Noida")
        self.create_noida_global_stops(city)
        rows = self.noida_rows()
        rows[0]["city_id"] = "lucknow"
        payload = self.noida_upload(rows=rows)
        preview = self.client.post(self.url, payload, format="multipart")
        self.assertEqual(preview.status_code, 200)
        self.assertEqual(preview.data["data"]["report"]["routes_valid"], 1)
        self.assertEqual(preview.data["data"]["report"]["invalid_rows"], 3)

        duplicate_rows = self.noida_rows()
        duplicate_rows[1]["stop_sequence"] = 1
        duplicate = self.client.post(self.url, self.noida_upload(rows=duplicate_rows), format="multipart")
        self.assertEqual(duplicate.status_code, 200)
        self.assertTrue(any("duplicate stop_sequence" in item["reason"] for item in duplicate.data["data"]["errors"]))
        self.assertEqual(duplicate.data["data"]["report"]["routes_valid"], 1)
