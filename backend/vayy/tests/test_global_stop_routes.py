from unittest.mock import patch

from django.contrib.gis.geos import LineString, Point
from django.test import TestCase
from rest_framework.test import APIClient

from accounts.models import User
from transport.models import City, CityAdminConfiguration, Route, RouteStopAssociation, Stop
from transport.services.route_search_service import RouteSearchService
from transport.services.stop_discovery_service import StopDiscoveryService
from transport.services.osrm_service import OSRMService


class GlobalStopRouteTests(TestCase):
    def setUp(self):
        self.city = City.objects.create(name="Stop City")
        CityAdminConfiguration.objects.create(city=self.city, max_walk_to_stop_m=1500)
        self.origin = Point(80.9000, 26.8000, srid=4326)
        self.destination = Point(80.9000, 26.9000, srid=4326)
        self.pickup = Stop.objects.create(
            city=self.city, name="Candidate pickup", location=Point(80.9002, 26.8002, srid=4326),
            coordinate_status="provisional",
        )
        self.middle = Stop.objects.create(
            city=self.city, name="Middle", location=Point(80.9000, 26.8500, srid=4326),
            coordinate_status="unresolved",
        )
        self.dropoff = Stop.objects.create(
            city=self.city, name="Candidate destination", location=Point(80.9001, 26.8998, srid=4326),
            coordinate_status="provisional",
        )
        self.route = Route.objects.create(
            city=self.city, name="Public direction", route_code="S-1",
            path=LineString([(80.9, 26.8), (80.9, 26.9)], srid=4326),
            is_public=True,
        )

    def candidates(self):
        return (
            StopDiscoveryService.nearby_global_stops(self.city.id, self.origin, 1500),
            StopDiscoveryService.nearby_global_stops(self.city.id, self.destination, 1500),
        )

    def add_direction(self, stops=None):
        for order, stop in enumerate(stops or [self.pickup, self.middle, self.dropoff]):
            RouteStopAssociation.objects.create(route=self.route, stop=stop, order=order)

    def test_global_candidates_include_unverified_and_are_nearest_first(self):
        farther = Stop.objects.create(
            city=self.city, name="Farther candidate", location=Point(80.901, 26.8, srid=4326),
            coordinate_status="unresolved",
        )
        nearest = StopDiscoveryService.nearby_global_stops(self.city.id, self.origin, 1500)
        self.assertEqual(nearest[0].id, self.pickup.id)
        self.assertIn(farther.id, [stop.id for stop in nearest])

    def test_geocode_db_search_includes_city_for_global_stops(self):
        noida = City.objects.create(name="Noida")
        Stop.objects.create(
            city=noida, name="Amity University Noida",
            location=Point(77.3327483, 28.5432229, srid=4326), coordinate_status="provisional",
        )
        response = APIClient().get(
            "/api/transport/geocode/db/search/",
            {"q": "Amity University Noida", "limit": 10},
        )
        self.assertEqual(response.status_code, 200)
        result = next(item for item in response.data["data"] if item["city_name"] == "Noida")
        self.assertIn("Noida", result["display_name"])
        self.assertEqual(result["stop_id"], result["id"])

    def test_ordered_shared_stop_membership_matches_direction_and_preserves_sequence(self):
        self.add_direction()
        pickups, drops = self.candidates()
        pairs = RouteSearchService.find_associated_route_pairs(self.city.id, pickups, drops)
        self.assertEqual(len(pairs), 1)
        self.assertEqual(pairs[0]["route"].id, self.route.id)
        self.assertEqual([row["stop"].id for row in pairs[0]["stops"]], [
            self.pickup.id, self.middle.id, self.dropoff.id,
        ])

    def test_multiple_nearby_endpoint_stops_do_not_duplicate_a_route_result(self):
        alternate_pickup = Stop.objects.create(
            city=self.city, name="Alternate pickup", location=Point(80.9003, 26.8001, srid=4326),
            coordinate_status="provisional",
        )
        self.add_direction([alternate_pickup, self.pickup, self.middle, self.dropoff])
        pickups, drops = self.candidates()
        pairs = RouteSearchService.find_associated_route_pairs(self.city.id, pickups, drops)
        self.assertEqual([pair["route"].id for pair in pairs], [self.route.id])
        self.assertIn(pairs[0]["pickup_stop"].id, {alternate_pickup.id, self.pickup.id})

    def test_destination_before_pickup_is_rejected_unless_reverse_direction_exists(self):
        self.add_direction([self.dropoff, self.middle, self.pickup])
        pickups, drops = self.candidates()
        self.assertEqual(RouteSearchService.find_associated_route_pairs(self.city.id, pickups, drops), [])

        reverse = Route.objects.create(
            city=self.city, name="Return direction", route_code="S-1-R",
            path=LineString([(80.9, 26.9), (80.9, 26.8)], srid=4326), is_public=True,
        )
        for order, stop in enumerate([self.pickup, self.middle, self.dropoff]):
            RouteStopAssociation.objects.create(route=reverse, stop=stop, order=order)
        self.assertEqual(
            [pair["route"].id for pair in RouteSearchService.find_associated_route_pairs(self.city.id, pickups, drops)],
            [reverse.id],
        )

    def test_boarding_alighting_rules_and_duplicate_membership_rows_are_enforced(self):
        self.add_direction()
        RouteStopAssociation.objects.filter(route=self.route, stop=self.pickup).update(boarding_allowed=False)
        pickups, drops = self.candidates()
        self.assertEqual(RouteSearchService.find_associated_route_pairs(self.city.id, pickups, drops), [])
        RouteStopAssociation.objects.filter(route=self.route, stop=self.pickup).update(boarding_allowed=True)
        RouteStopAssociation.objects.filter(route=self.route, stop=self.dropoff).update(alighting_allowed=False)
        self.assertEqual(RouteSearchService.find_associated_route_pairs(self.city.id, pickups, drops), [])

        RouteStopAssociation.objects.filter(route=self.route, stop=self.dropoff).update(alighting_allowed=True)
        RouteStopAssociation.objects.create(route=self.route, stop=self.pickup, order=3)
        self.assertEqual(RouteSearchService.find_associated_route_pairs(self.city.id, pickups, drops), [])

    def test_unassociated_global_stops_do_not_prove_a_route(self):
        pickups, drops = self.candidates()
        self.assertEqual(RouteSearchService.find_associated_route_pairs(self.city.id, pickups, drops), [])

    def test_dynamic_preview_returns_road_paths_and_displays_osrm_snapped_route_stops(self):
        self.add_direction()
        user = User.objects.create_user(email="route-passenger@test.invalid", password="pw", role="passenger")
        client = APIClient()
        client.force_authenticate(user=user)
        osrm_route = {
            "routes": [{
                "distance": 11000, "duration": 1200,
                "geometry": {"type": "LineString", "coordinates": [[80.91, 26.8], [80.91, 26.9]]},
            }],
        }
        walking = {"distance": 300, "duration": 226, "profile": "driving",
                   "duration_is_estimate": True,
                   "geometry": {"type": "LineString", "coordinates": [[80.9, 26.8], [80.9002, 26.8002]]}}
        with patch("transport.api.dynamic_admin_views.OSRMService.route", return_value=osrm_route), \
             patch.object(OSRMService, "get_walking_path", return_value=walking):
            response = client.post("/api/transport/routes/dynamic-preview/", {
                "city_id": str(self.city.id),
                "origin": {"lat": self.origin.y, "lng": self.origin.x},
                "destination": {"lat": self.destination.y, "lng": self.destination.x},
                "vehicle_type": "bike",
            }, format="json")
        self.assertEqual(response.status_code, 200, response.data)
        trip = response.data["data"]["routes"][0]
        self.assertIsNone(trip["route"]["id"])
        self.assertTrue(trip["route"]["preview_only"])
        self.assertEqual(trip["route"]["route_source"], "osrm_global_stops")
        self.assertEqual(trip["route"]["geometry"]["coordinates"], [[80.91, 26.8], [80.91, 26.9]])
        self.assertEqual([stop["id"] for stop in trip["stops"]], [str(self.pickup.id), str(self.dropoff.id)])
        self.assertTrue(trip["route"]["walking_directions_available"])
        self.assertEqual(trip["route"]["first_mile_walk_meters"], 300)
        self.assertEqual(trip["route"]["walking_path"], walking["geometry"])
        self.assertEqual(trip["route"]["pickup_stop"]["lat"], 26.8)
        self.assertEqual(trip["route"]["pickup_stop"]["global_location"],
                         {"lat": self.pickup.location.y, "lng": self.pickup.location.x})
        self.assertEqual(Stop.objects.filter(city=self.city, is_global=True).count(), 3)

    def test_dynamic_preview_works_without_route_memberships_and_does_not_persist(self):
        user = User.objects.create_user(email="route-empty@test.invalid", password="pw", role="passenger")
        client = APIClient()
        client.force_authenticate(user=user)
        walking = {"distance": 300, "duration": 226, "profile": "driving",
                   "duration_is_estimate": True,
                   "geometry": {"type": "LineString", "coordinates": [[80.9, 26.8], [80.9002, 26.8002]]}}
        with patch("transport.api.dynamic_admin_views.OSRMService.route", return_value={
            "routes": [{"distance": 10000, "duration": 1200,
                        "geometry": {"type": "LineString", "coordinates": [[80.9002, 26.8002], [80.9001, 26.8998]]}}],
        }), patch.object(OSRMService, "get_walking_path", return_value=walking):
            response = client.post("/api/transport/routes/dynamic-preview/", {
                "city_id": str(self.city.id),
                "origin": {"lat": self.origin.y, "lng": self.origin.x},
                "destination": {"lat": self.destination.y, "lng": self.destination.x},
            }, format="json")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(response.data["data"]["routes"]), 1)
        self.assertEqual(Route.objects.count(), 1)
        self.assertEqual(RouteStopAssociation.objects.count(), 0)

    def test_walking_profile_selects_the_stop_with_shortest_real_access_route(self):
        farther = Stop.objects.create(
            city=self.city, name="Better walking access", location=Point(80.9005, 26.8000, srid=4326),
        )
        user = User.objects.create_user(email="route-walk-rank@test.invalid", password="pw", role="passenger")
        client = APIClient()
        client.force_authenticate(user=user)
        walking_paths = [
            {"distance": 600, "duration": 500, "geometry": None},
            {"distance": 200, "duration": 160, "geometry": None},
            {"distance": 100, "duration": 80, "geometry": None},
        ]
        osrm_route = {"routes": [{"distance": 10000, "duration": 1200,
                                   "geometry": {"type": "LineString", "coordinates": [[80.9005, 26.8], [80.9001, 26.8998]]}}]}
        with patch.object(OSRMService, "WALKING_PROFILE", "foot"), \
             patch.object(OSRMService, "get_walking_path", side_effect=walking_paths), \
             patch("transport.api.dynamic_admin_views.OSRMService.route", return_value=osrm_route):
            response = client.post("/api/transport/routes/dynamic-preview/", {
                "city_id": str(self.city.id),
                "origin": {"lat": self.origin.y, "lng": self.origin.x},
                "destination": {"lat": self.destination.y, "lng": self.destination.x},
            }, format="json")
        self.assertEqual(response.status_code, 200, response.data)
        route = response.data["data"]["routes"][0]["route"]
        self.assertEqual(route["pickup_stop"]["id"], str(farther.id))
        self.assertEqual(route["first_mile_walk_meters"], 200)

    def test_dynamic_generate_persists_route_using_existing_global_stop_ids(self):
        user = User.objects.create_user(email="route-generate@test.invalid", password="pw", role="passenger")
        client = APIClient()
        client.force_authenticate(user=user)
        walking = {"distance": 300, "duration": 226, "profile": "driving",
                   "duration_is_estimate": True,
                   "geometry": {"type": "LineString", "coordinates": [[80.9, 26.8], [80.9002, 26.8002]]}}
        with patch("transport.api.dynamic_admin_views.OSRMService.route", return_value={
            "routes": [{"distance": 10000, "duration": 1200,
                        "geometry": {"type": "LineString", "coordinates": [[80.9002, 26.8002], [80.9001, 26.8998]]}}],
        }), patch.object(OSRMService, "get_walking_path", return_value=walking):
            response = client.post("/api/transport/routes/dynamic-generate/", {
                "city_id": str(self.city.id),
                "origin": {"lat": self.origin.y, "lng": self.origin.x},
                "destination": {"lat": self.destination.y, "lng": self.destination.x},
            }, format="json")
        self.assertEqual(response.status_code, 201, response.data)
        route_id = response.data["data"]["routes"][0]["route"]["id"]
        self.assertEqual(RouteStopAssociation.objects.filter(route_id=route_id).count(), 2)
        self.assertEqual(set(RouteStopAssociation.objects.filter(route_id=route_id).values_list("stop_id", flat=True)),
                         {self.pickup.id, self.dropoff.id})
        self.assertEqual(Stop.objects.filter(city=self.city, is_global=True).count(), 3)

    def test_dynamic_preview_validates_coordinates_and_authentication(self):
        user = User.objects.create_user(email="route-invalid@test.invalid", password="pw", role="passenger")
        client = APIClient()
        client.force_authenticate(user=user)
        invalid = client.post("/api/transport/routes/dynamic-preview/", {
            "city_id": str(self.city.id), "origin": {"lat": 91, "lng": 0},
            "destination": {"lat": 0, "lng": 0},
        }, format="json")
        self.assertEqual(invalid.status_code, 400)
        self.assertEqual(APIClient().post("/api/transport/routes/dynamic-preview/", {}, format="json").status_code, 401)

    def test_walking_path_falls_back_to_road_profile_and_estimates_human_duration(self):
        result = {
            "routes": [{"distance": 320, "duration": 240,
                        "geometry": {"type": "LineString", "coordinates": [[80.9, 26.8], [80.901, 26.801]]}}],
        }
        with patch.object(OSRMService, "WALKING_PROFILE", ""), \
             patch.object(OSRMService, "route", return_value=result), \
             patch.object(OSRMService, "_route_snap_is_valid", return_value=True):
            road_path = OSRMService.get_walking_path((80.9, 26.8), (80.901, 26.801))
        with patch.object(OSRMService, "WALKING_PROFILE", "walking"), \
             patch.object(OSRMService, "route", return_value=result), \
             patch.object(OSRMService, "_route_snap_is_valid", return_value=True):
            walking = OSRMService.get_walking_path((80.9, 26.8), (80.901, 26.801))
        self.assertEqual(road_path["profile"], "driving")
        self.assertAlmostEqual(road_path["duration"], 320 / 1.33)
        self.assertTrue(road_path["duration_is_estimate"])
        self.assertEqual(walking["distance"], 320)
        self.assertEqual(walking["geometry"], result["routes"][0]["geometry"])

    def test_walking_path_endpoint_returns_road_path_and_marks_estimated_duration(self):
        road_path = {"distance": 320, "duration": 241, "profile": "driving",
                     "duration_is_estimate": True,
                     "geometry": {"type": "LineString", "coordinates": [[80.9, 26.8], [80.901, 26.801]]}}
        with patch.object(OSRMService, "WALKING_PROFILE", ""), \
             patch.object(OSRMService, "get_walking_path", return_value=road_path):
            response = APIClient().post("/api/transport/walking-path/", {
                "origin_lat": 26.8, "origin_lng": 80.9,
                "dest_lat": 26.801, "dest_lng": 80.901,
            }, format="json")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["data"]["path"], road_path["geometry"])
        self.assertTrue(response.data["data"]["duration_is_estimate"])

    def test_walking_path_endpoint_rejects_out_of_range_and_over_limit_paths(self):
        client = APIClient()
        invalid = client.post("/api/transport/walking-path/", {
            "origin_lat": 91, "origin_lng": 80.9,
            "dest_lat": 26.8, "dest_lng": 80.9,
        }, format="json")
        self.assertEqual(invalid.status_code, 400)

        far_path = {"distance": 1501, "duration": 1128, "profile": "driving",
                    "duration_is_estimate": True,
                    "geometry": {"type": "LineString", "coordinates": [[77.3, 28.5], [80.9, 26.8]]}}
        with patch.object(OSRMService, "get_walking_path", return_value=far_path):
            too_far = client.post("/api/transport/walking-path/", {
                "city_id": str(self.city.id),
                "origin_lat": 28.5, "origin_lng": 77.3,
                "dest_lat": 26.8, "dest_lng": 80.9,
            }, format="json")
        self.assertEqual(too_far.status_code, 422)
        self.assertEqual(too_far.data["code"], "WALKING_PATH_TOO_FAR")

    def test_multi_stop_road_geometry_requires_all_waypoints_to_snap(self):
        route_result = {
            "routes": [{"distance": 2400, "duration": 600,
                        "geometry": {"type": "LineString", "coordinates": [[80.9, 26.8], [80.91, 26.85], [80.92, 26.9]]}}],
            "waypoints": [{"distance": 10}, {"distance": 15}, {"distance": 20}],
        }
        points = ((80.9, 26.8), (80.91, 26.85), (80.92, 26.9))
        with patch.object(OSRMService, "route", return_value=route_result):
            geometry = OSRMService.get_road_path_through(*points)
        self.assertEqual(geometry["distance"], 2400)
        self.assertEqual(len(geometry["geometry"]["coordinates"]), 3)

        route_result["waypoints"][1]["distance"] = 9000
        with patch.object(OSRMService, "route", return_value=route_result):
            self.assertIsNone(OSRMService.get_road_path_through(
                (80.9001, 26.8001), (80.9101, 26.8501), (80.9201, 26.9001),
            ))

    def test_dynamic_preview_returns_structured_error_when_transport_geometry_fails(self):
        self.add_direction()
        user = User.objects.create_user(email="route-osrm@test.invalid", password="pw", role="passenger")
        client = APIClient()
        client.force_authenticate(user=user)
        walking = {"distance": 300, "duration": 226, "profile": "driving",
                   "duration_is_estimate": True,
                   "geometry": {"type": "LineString", "coordinates": [[80.9, 26.8], [80.9002, 26.8002]]}}
        with patch("transport.api.dynamic_admin_views.OSRMService.route", return_value=None), \
             patch.object(OSRMService, "get_walking_path", return_value=walking):
            response = client.post("/api/transport/routes/dynamic-preview/", {
                "city_id": str(self.city.id),
                "origin": {"lat": self.origin.y, "lng": self.origin.x},
                "destination": {"lat": self.destination.y, "lng": self.destination.x},
            }, format="json")
        self.assertEqual(response.status_code, 502)
        self.assertEqual(response.data["code"], "ROUTE_GEOMETRY_UNAVAILABLE")

    def test_dynamic_generate_resolves_each_endpoint_city_from_global_stops(self):
        destination_city = City.objects.create(name="Destination City")
        CityAdminConfiguration.objects.create(city=destination_city, max_walk_to_stop_m=1200)
        destination_stop = Stop.objects.create(
            city=destination_city, name="Destination City Stop",
            location=Point(self.destination.x, self.destination.y, srid=4326), coordinate_status="provisional",
        )
        user = User.objects.create_user(email="cross-city-route@test.invalid", password="pw", role="passenger")
        client = APIClient()
        client.force_authenticate(user=user)
        route = {
            "routes": [{"distance": 12000, "duration": 1800,
                        "geometry": {"type": "LineString", "coordinates": [[80.9002, 26.8002], [80.9001, 26.8998]]}}],
        }
        walking = {"distance": 100, "duration": 75,
                   "geometry": {"type": "LineString", "coordinates": [[80.9, 26.8], [80.9001, 26.8001]]}}
        with patch("transport.api.dynamic_admin_views.OSRMService.route", return_value=route), \
             patch.object(OSRMService, "get_walking_path", return_value=walking):
            response = client.post("/api/transport/routes/dynamic-generate/", {
                "city_id": None,
                "origin": {"lat": self.origin.y, "lng": self.origin.x},
                "destination": {"lat": self.destination.y, "lng": self.destination.x},
                "vehicle_type": "bike",
            }, format="json")

        self.assertEqual(response.status_code, 201, response.data)
        route_preview = response.data["data"]["routes"][0]
        self.assertEqual(route_preview["route"]["pickup_stop"]["id"], str(self.pickup.id))
        self.assertEqual(route_preview["route"]["dropoff_stop"]["id"], str(destination_stop.id))
        saved_route = Route.objects.get(pk=route_preview["route"]["id"])
        self.assertEqual(saved_route.city_id, self.city.id)
        self.assertEqual(set(saved_route.route_stop_associations.values_list("stop_id", flat=True)), {
            self.pickup.id, destination_stop.id,
        })

    def test_dynamic_preview_rejects_route_stops_snapped_far_from_routable_roads(self):
        user = User.objects.create_user(email="route-snap@test.invalid", password="pw", role="passenger")
        client = APIClient()
        client.force_authenticate(user=user)
        route = {
            "routes": [{"distance": 10000, "duration": 1200,
                        "geometry": {"type": "LineString", "coordinates": [[80.91, 26.8], [80.91, 26.9]]}}],
            "waypoints": [{"distance": 7000}, {"distance": 20}],
        }
        walking = {"distance": 300, "duration": 226, "profile": "driving",
                   "duration_is_estimate": True,
                   "geometry": {"type": "LineString", "coordinates": [[80.9, 26.8], [80.9002, 26.8002]]}}
        with patch("transport.api.dynamic_admin_views.OSRMService.route", return_value=route), \
             patch.object(OSRMService, "get_walking_path", return_value=walking):
            response = client.post("/api/transport/routes/dynamic-preview/", {
                "city_id": str(self.city.id),
                "origin": {"lat": self.origin.y, "lng": self.origin.x},
                "destination": {"lat": self.destination.y, "lng": self.destination.x},
            }, format="json")
        self.assertEqual(response.status_code, 502)
        self.assertEqual(response.data["code"], "ROUTE_SNAP_TOO_FAR")

    def test_dynamic_preview_reports_walking_router_failure_as_dependency_error(self):
        self.add_direction()
        user = User.objects.create_user(email="route-walk-failure@test.invalid", password="pw", role="passenger")
        client = APIClient()
        client.force_authenticate(user=user)
        with patch.object(OSRMService, "WALKING_PROFILE", "walking"), \
             patch("transport.api.dynamic_admin_views.OSRMService.route", return_value={
                 "routes": [{"distance": 11000, "duration": 1200,
                             "geometry": {"type": "LineString", "coordinates": [[80.91, 26.8], [80.91, 26.9]]}}],
             }), \
             patch.object(OSRMService, "get_walking_path", return_value=None):
            response = client.post("/api/transport/routes/dynamic-preview/", {
                "city_id": str(self.city.id),
                "origin": {"lat": self.origin.y, "lng": self.origin.x},
                "destination": {"lat": self.destination.y, "lng": self.destination.x},
            }, format="json")
        self.assertEqual(response.status_code, 502)
        self.assertEqual(response.data["code"], "WALKING_DIRECTIONS_UNAVAILABLE")

    def test_dynamic_preview_returns_empty_when_walking_legs_exceed_pickup_limit(self):
        self.add_direction()
        user = User.objects.create_user(email="route-walk-limit@test.invalid", password="pw", role="passenger")
        client = APIClient()
        client.force_authenticate(user=user)
        route = {
            "routes": [{"distance": 11000, "duration": 1200,
                        "geometry": {"type": "LineString", "coordinates": [[80.91, 26.8], [80.91, 26.9]]}}],
        }
        walking = {"distance": 1501, "duration": 1200,
                   "geometry": {"type": "LineString", "coordinates": [[80.9, 26.8], [80.901, 26.801]]}}
        with patch.object(OSRMService, "WALKING_PROFILE", "walking"), \
             patch("transport.api.dynamic_admin_views.OSRMService.route", return_value=route), \
             patch.object(OSRMService, "get_walking_path", return_value=walking):
            response = client.post("/api/transport/routes/dynamic-preview/", {
                "city_id": str(self.city.id),
                "origin": {"lat": self.origin.y, "lng": self.origin.x},
                "destination": {"lat": self.destination.y, "lng": self.destination.x},
            }, format="json")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["data"]["routes"], [])
        self.assertEqual(response.data["data"]["empty_reason"], "NO_WALKABLE_STOPS")

    def test_admin_ordered_stop_action_reuses_global_records_and_rejects_duplicates(self):
        admin = User.objects.create_user(email="route-admin@test.invalid", password="pw", role="admin")
        client = APIClient()
        client.force_authenticate(user=admin)
        response = client.put(
            f"/api/transport/admin/routes/{self.route.id}/ordered-stops/",
            {"stops": [{"stop_id": str(self.pickup.id), "order": 0}, {"stop_id": str(self.dropoff.id), "order": 1}],
             "path": {"type": "LineString", "coordinates": [[80.9, 26.8], [80.9, 26.9]]}, "total_distance_meters": 12000},
            format="json",
        )
        self.assertEqual(response.status_code, 200, response.data)
        self.assertEqual(RouteStopAssociation.objects.filter(route=self.route).count(), 2)
        self.assertEqual(Stop.objects.filter(city=self.city, is_global=True).count(), 3)

        duplicate = client.put(
            f"/api/transport/admin/routes/{self.route.id}/ordered-stops/",
            {"stops": [{"stop_id": str(self.pickup.id), "order": 0}, {"stop_id": str(self.pickup.id), "order": 1}],
             "path": {"type": "LineString", "coordinates": [[80.9, 26.8], [80.9, 26.9]]}, "total_distance_meters": 12000},
            format="json",
        )
        self.assertEqual(duplicate.status_code, 400)
        self.assertEqual(RouteStopAssociation.objects.filter(route=self.route).count(), 2)

    def test_admin_creates_route_from_existing_stops_reorders_and_publishes(self):
        admin = User.objects.create_user(email="route-builder@test.invalid", password="pw", role="admin")
        client = APIClient()
        client.force_authenticate(user=admin)
        created = client.post("/api/transport/admin/routes/", {
            "city": str(self.city.id), "name": "Campus Line", "route_code": "LKO-1",
            "direction_name": "SGPGI to IIM", "is_public": False,
            "path": {"type": "LineString", "coordinates": [[80.9, 26.8], [80.9, 26.9]]},
        }, format="json")
        self.assertEqual(created.status_code, 201, created.data)
        route_id = created.data["data"]["id"]
        self.assertEqual(created.data["data"]["direction_name"], "SGPGI to IIM")
        self.assertEqual(created.data["data"]["path"]["type"], "LineString")

        ordered = client.put(f"/api/transport/admin/routes/{route_id}/ordered-stops/", {
            "stops": [
                {"stop_id": str(self.pickup.id), "order": 0},
                {"stop_id": str(self.middle.id), "order": 1},
                {"stop_id": str(self.dropoff.id), "order": 2},
            ],
            "path": {"type": "LineString", "coordinates": [[80.9, 26.8], [80.9, 26.9]]},
            "total_distance_meters": 12000,
        }, format="json")
        self.assertEqual(ordered.status_code, 200, ordered.data)
        reordered = client.put(f"/api/transport/admin/routes/{route_id}/ordered-stops/", {
            "stops": [
                {"stop_id": str(self.middle.id), "order": 0},
                {"stop_id": str(self.pickup.id), "order": 1},
                {"stop_id": str(self.dropoff.id), "order": 2},
            ],
            "path": {"type": "LineString", "coordinates": [[80.9, 26.85], [80.9, 26.8], [80.9, 26.9]]},
            "total_distance_meters": 15000,
            "start_name": "Middle", "end_name": "Candidate destination",
        }, format="json")
        self.assertEqual(reordered.status_code, 200, reordered.data)
        self.assertEqual([row["id"] for row in reordered.data["data"]["route_memberships"]], [
            str(self.middle.id), str(self.pickup.id), str(self.dropoff.id),
        ])
        published = client.patch(f"/api/transport/admin/routes/{route_id}/", {"is_public": True}, format="json")
        self.assertEqual(published.status_code, 200, published.data)
        self.assertTrue(Route.objects.get(pk=route_id).is_public)
        route = Route.objects.get(pk=route_id)
        self.assertEqual(route.total_distance_meters, 15000)
        self.assertEqual(tuple(route.path.coords[0]), (80.9, 26.85))
        self.assertEqual(Stop.objects.filter(city=self.city, is_global=True).count(), 3)
        journey = {
            "city_id": str(self.city.id),
            "origin": {"lat": self.origin.y, "lng": self.origin.x},
            "destination": {"lat": self.destination.y, "lng": self.destination.x},
        }
        osrm_route = {"routes": [{"distance": 12000, "duration": 1600,
                                  "geometry": {"type": "LineString", "coordinates": [[80.9, 26.8], [80.9, 26.9]]}}]}
        walking = {"distance": 300, "duration": 226, "profile": "driving",
                   "duration_is_estimate": True,
                   "geometry": {"type": "LineString", "coordinates": [[80.9, 26.8], [80.9002, 26.8002]]}}
        with patch.object(OSRMService, "WALKING_PROFILE", ""), \
             patch("transport.api.dynamic_admin_views.OSRMService.route", return_value=osrm_route), \
             patch.object(OSRMService, "get_walking_path", return_value=walking):
            found = client.post("/api/transport/routes/dynamic-preview/", journey, format="json")
        self.assertEqual(found.status_code, 200, found.data)
        generated_preview = found.data["data"]["routes"][0]
        self.assertTrue(generated_preview["route"]["preview_only"])
        self.assertEqual(generated_preview["route"]["route_source"], "osrm_global_stops")
        self.assertEqual(generated_preview["route"]["pickup_stop"]["id"], str(self.pickup.id))

        client.patch(f"/api/transport/admin/routes/{route_id}/", {"is_public": False}, format="json")
        with patch.object(OSRMService, "get_walking_path", return_value=walking):
            empty = client.post("/api/transport/routes/dynamic-preview/", journey, format="json")
        self.assertEqual(empty.status_code, 200, empty.data)
        self.assertEqual(len(empty.data["data"]["routes"]), 1)

    def test_admin_route_creation_requires_real_line_geometry(self):
        admin = User.objects.create_user(email="route-geometry@test.invalid", password="pw", role="admin")
        client = APIClient()
        client.force_authenticate(user=admin)
        response = client.post("/api/transport/admin/routes/", {
            "city": str(self.city.id), "name": "No geometry", "is_public": False,
        }, format="json")
        self.assertEqual(response.status_code, 400)
        self.assertEqual(Route.objects.filter(name="No geometry").count(), 0)

    def test_route_import_does_not_create_route_without_real_osrm_geometry(self):
        admin = User.objects.create_user(email="route-import-geometry@test.invalid", password="pw", role="admin")
        client = APIClient()
        client.force_authenticate(user=admin)
        routes_before = Route.objects.count()
        stops_before = Stop.objects.count()
        with patch("transport.api.views.OSRMService.get_road_path_through", return_value=None):
            response = client.post("/api/transport/admin/route-import/", {
                "city": str(self.city.id), "route_name": "No fake path", "stops": [
                    {"name": "A", "lat": 26.8, "lon": 80.9, "order": 0},
                    {"name": "B", "lat": 26.9, "lon": 80.9, "order": 1},
                ],
            }, format="json")
        self.assertEqual(response.status_code, 502)
        self.assertEqual(response.data["code"], "ROAD_GEOMETRY_UNAVAILABLE")
        self.assertEqual(Route.objects.count(), routes_before)
        self.assertEqual(Stop.objects.count(), stops_before)

    def test_invalid_association_sequence_is_rejected_without_losing_saved_rows(self):
        admin = User.objects.create_user(email="route-sequence@test.invalid", password="pw", role="admin")
        client = APIClient()
        client.force_authenticate(user=admin)
        self.add_direction()
        without_geometry = client.put(f"/api/transport/admin/routes/{self.route.id}/ordered-stops/", [
            {"stop_id": str(self.pickup.id), "order": 0},
            {"stop_id": str(self.dropoff.id), "order": 1},
        ], format="json")
        self.assertEqual(without_geometry.status_code, 400)
        response = client.put(f"/api/transport/admin/routes/{self.route.id}/ordered-stops/", [
            {"stop_id": str(self.pickup.id), "order": 0},
            {"stop_id": str(self.dropoff.id), "order": 2},
        ], format="json")
        self.assertEqual(response.status_code, 400)
        self.assertEqual(list(RouteStopAssociation.objects.filter(route=self.route).order_by("order").values_list("stop_id", flat=True)), [
            self.pickup.id, self.middle.id, self.dropoff.id,
        ])

    def test_removing_membership_keeps_global_stop_record(self):
        admin = User.objects.create_user(email="route-remove@test.invalid", password="pw", role="admin")
        client = APIClient()
        client.force_authenticate(user=admin)
        self.add_direction()
        response = client.put(f"/api/transport/admin/routes/{self.route.id}/ordered-stops/", {
            "stops": [
                {"stop_id": str(self.pickup.id), "order": 0},
                {"stop_id": str(self.dropoff.id), "order": 1},
            ],
            "path": {"type": "LineString", "coordinates": [[80.9, 26.8], [80.9, 26.9]]},
            "total_distance_meters": 12000,
        }, format="json")
        self.assertEqual(response.status_code, 200)
        self.assertTrue(Stop.objects.filter(pk=self.middle.id, is_global=True).exists())

    def test_admin_global_stop_selector_supports_nearby_provisional_inventory(self):
        admin = User.objects.create_user(email="route-stop-search@test.invalid", password="pw", role="admin")
        client = APIClient()
        client.force_authenticate(user=admin)
        response = client.get("/api/transport/admin/stops/", {
            "scope": "global", "city": str(self.city.id), "has_coordinates": 1,
            "near_lat": self.origin.y, "near_lng": self.origin.x, "radius_m": 1500,
            "limit": 10,
        })
        self.assertEqual(response.status_code, 200, response.data)
        self.assertEqual(response.data["results"][0]["id"], str(self.pickup.id))
        self.assertEqual(response.data["results"][0]["coordinate_status"], "provisional")
        self.assertGreater(response.data["results"][0]["distance_m"], 0)

    def test_route_preview_requires_valid_road_geometry(self):
        admin = User.objects.create_user(email="route-preview@test.invalid", password="pw", role="admin")
        client = APIClient()
        client.force_authenticate(user=admin)
        payload = {
            "start": {"lat": self.origin.y, "lon": self.origin.x},
            "end": {"lat": self.destination.y, "lon": self.destination.x},
            "stops": [],
        }
        road = {"distance": 12000, "duration": 1600,
                "geometry": {"type": "LineString", "coordinates": [[80.9, 26.8], [80.9, 26.9]]}}
        with patch("transport.api.views.OSRMService.get_road_path_through", return_value=road):
            success = client.post("/api/transport/routes/preview/", payload, format="json")
        self.assertEqual(success.status_code, 200, success.data)
        self.assertEqual(success.data[0]["path"], road["geometry"]["coordinates"])
        with patch("transport.api.views.OSRMService.get_road_path_through", return_value=None):
            failure = client.post("/api/transport/routes/preview/", payload, format="json")
        self.assertEqual(failure.status_code, 502)
        self.assertEqual(failure.data["code"], "ROAD_GEOMETRY_UNAVAILABLE")
        invalid = client.post("/api/transport/routes/preview/", {
            **payload, "start": {"lat": 100, "lon": self.origin.x},
        }, format="json")
        self.assertEqual(invalid.status_code, 400)

    def test_driver_road_directions_returns_osrm_geometry_and_turns(self):
        data = {
            "geometry": {"type": "LineString", "coordinates": [[80.9, 26.8], [80.91, 26.81]]},
            "distance": 1250,
            "duration": 220,
            "steps": [{"name": "Main Road", "distance_m": 400, "type": "turn", "modifier": "left", "location": [80.905, 26.805]}],
        }
        with patch("transport.api.views.OSRMService.get_road_directions", return_value=data):
            response = APIClient().post("/api/transport/road-directions/", {
                "origin_lat": 26.8, "origin_lng": 80.9,
                "dest_lat": 26.81, "dest_lng": 80.91,
            }, format="json")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["data"]["geometry"], data["geometry"])
        self.assertEqual(response.data["data"]["steps"][0]["modifier"], "left")

        invalid = APIClient().post("/api/transport/road-directions/", {
            "origin_lat": 91, "origin_lng": 80.9,
            "dest_lat": 26.81, "dest_lng": 0,
        }, format="json")
        self.assertEqual(invalid.status_code, 400)
