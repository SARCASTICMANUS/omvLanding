from unittest.mock import patch

from django.core.cache import cache
from django.test import SimpleTestCase, override_settings

from transport.services.osrm_service import OSRMService


@override_settings(CACHES={
    "default": {
        "BACKEND": "django.core.cache.backends.locmem.LocMemCache",
        "LOCATION": "osrm-route-coverage-tests",
    }
})
class OSRMRouteCoverageTests(SimpleTestCase):
    def setUp(self):
        cache.clear()
        self.origin = (76.65, 30.74)
        self.destination = (76.70, 30.80)
        self.route_response = {
            "code": "Ok",
            "routes": [{
                "distance": 8500.0,
                "duration": 900.0,
                "geometry": {
                    "type": "LineString",
                    "coordinates": [list(self.origin), list(self.destination)],
                },
            }],
            "waypoints": [
                {"distance": 12.0, "location": list(self.origin)},
                {"distance": 18.0, "location": list(self.destination)},
            ],
        }

    def tearDown(self):
        cache.clear()

    @override_settings(OSRM_MAX_SNAP_DISTANCE_M=5000)
    def test_route_with_nearby_snaps_is_accepted(self):
        with patch.object(OSRMService, "route", return_value=self.route_response):
            result = OSRMService.get_road_path(self.origin, self.destination)
        self.assertIsNotNone(result)
        self.assertEqual(result["distance"], 8500.0)

    @override_settings(OSRM_MAX_SNAP_DISTANCE_M=5000)
    def test_route_snapped_outside_the_loaded_region_is_rejected(self):
        self.route_response["waypoints"][0]["distance"] = 92791.9
        with patch.object(OSRMService, "route", return_value=self.route_response):
            result = OSRMService.get_road_path(self.origin, self.destination)
        self.assertIsNone(result)


    @override_settings(OSRM_MAX_SNAP_DISTANCE_M=5000)
    def test_fare_metrics_reject_route_snapped_outside_loaded_region(self):
        self.route_response["waypoints"][0]["distance"] = 92791.9
        with patch.object(OSRMService, "route", return_value=self.route_response):
            result = OSRMService.get_road_metrics(self.origin, self.destination)
        self.assertIsNone(result)

    @override_settings(OSRM_MAX_SNAP_DISTANCE_M=5000)
    def test_fare_metrics_accept_nearby_snaps(self):
        with patch.object(OSRMService, "route", return_value=self.route_response):
            result = OSRMService.get_road_metrics(self.origin, self.destination)
        self.assertEqual(result, {"distance": 8500.0, "duration": 900.0})

    def test_missing_snap_metadata_is_rejected(self):
        self.route_response.pop("waypoints")
        with patch.object(OSRMService, "route", return_value=self.route_response):
            result = OSRMService.get_road_path(self.origin, self.destination)
        self.assertIsNone(result)
