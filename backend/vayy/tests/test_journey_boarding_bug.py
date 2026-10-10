"""
Journey hand-raise pickup/drop validation.

A journey (route=NULL) serves the global stops on its cached path. These tests
pin the rule that a passenger can only raise a hand for a stop that journey
actually passes, and can only drop at a global stop that lies *after* the pickup
along the path.

The bug these guard against: pickup/drop were resolved with
``Stop.objects.filter(id=..., route_id=trip.route_id)``. For a journey
route_id is NULL, so that compiles to ``route_id IS NULL`` and matches every
route-less stop in the database -- including ones no driver will pass -- and an
unresolvable drop id silently became None, which calculate_segment_fare
prices at 0.0.
"""

from django.contrib.gis.geos import Point
from django.test import TestCase

from accounts.models import PublicDriverProfile, User
from operations.api.serializers import BoardingRequestCreateSerializer
from operations.models import ActiveTrip, BoardingRequest, Vehicle, VehicleState
from operations.services.boarding_service import BoardingService
from tracking.services.journey_cache_service import JourneyCacheService

from common.constants import BOARDING_BOARDED, BOARDING_PENDING
from transport.models import Stop


class JourneyBoardingStopResolutionTests(TestCase):
    def setUp(self):
        self.driver = User.objects.create_user(
            email="jb-driver", password="x", role="bikedriver"
        )
        PublicDriverProfile.objects.create(
            user=self.driver, display_name="JB Driver", rating=4.5
        )
        self.passenger = User.objects.create_user(
            email="jb-passenger", password="x", role="passenger"
        )
        self.vehicle = Vehicle.objects.create(
            vehicle_number="JRN-1", vehicle_type="bike", driver=self.driver
        )
        VehicleState.objects.create(vehicle=self.vehicle)

        # Three global stops. The journey serves the first two; the third is a
        # global stop that belongs to nobody and lies off this path.
        self.first_stop = StopFactory.create("Global First", 77.300, 12.980)
        self.second_stop = StopFactory.create("Global Second", 77.310, 12.990)
        self.unrelated_stop = StopFactory.create("Unrelated Global", 77.900, 12.400)

        self.trip = ActiveTrip.objects.create(
            driver=self.driver, vehicle=self.vehicle, route=None, status="active"
        )
        # The cache is the authority for "which stops does this journey serve".
        JourneyCacheService.save_journey(
            trip_id=str(self.trip.id),
            path_coords=[[12.980, 77.300], [12.990, 77.310]],
            distance_m=1500.0,
            duration_s=180.0,
            origin=(12.980, 77.300),
            destination=(12.990, 77.310),
            ordered_stops=[
                {
                    "stop_id": str(self.first_stop.id),
                    "name": self.first_stop.name,
                    "nearby_landmark": "",
                    "lat": 12.980,
                    "lng": 77.300,
                    "dist_along_m": 0.0,
                    "corridor_distance_m": 5.0,
                    "segment_index": 0,
                },
                {
                    "stop_id": str(self.second_stop.id),
                    "name": self.second_stop.name,
                    "nearby_landmark": "",
                    "lat": 12.990,
                    "lng": 77.310,
                    "dist_along_m": 1500.0,
                    "corridor_distance_m": 5.0,
                    "segment_index": 1,
                },
            ],
        )

    def tearDown(self):
        JourneyCacheService.delete_journey(str(self.trip.id))

    def _serialize(self, pickup, drop=None):
        data = {"trip": str(self.trip.id), "pickup_stop": str(pickup.id)}
        if drop is not None:
            data["drop_stop"] = str(drop.id)
        return BoardingRequestCreateSerializer(data=data)

    def test_stop_on_journey_is_valid_pickup(self):
        s = self._serialize(self.first_stop, self.second_stop)
        self.assertTrue(s.is_valid(), s.errors)
        self.assertEqual(s.validated_data["pickup_stop"].id, self.first_stop.id)
        self.assertEqual(s.validated_data["drop_stop"].id, self.second_stop.id)

    def test_global_stop_not_on_this_journey_is_rejected(self):
        """The core regression: route_id IS NULL must not match everything."""
        s = self._serialize(self.unrelated_stop)
        self.assertFalse(s.is_valid())
        self.assertIn("pickup_stop", s.errors)

    def test_drop_stop_not_on_journey_is_rejected(self):
        s = self._serialize(self.first_stop, self.unrelated_stop)
        self.assertFalse(s.is_valid())
        self.assertIn("drop_stop", s.errors)

    def test_drop_before_pickup_is_rejected(self):
        """Driver would have to drive backwards; segment fare would be nonsense."""
        s = self._serialize(self.second_stop, self.first_stop)
        self.assertFalse(s.is_valid())
        self.assertIn("drop_stop", s.errors)

    def test_drop_is_optional(self):
        s = self._serialize(self.first_stop)
        self.assertTrue(s.is_valid(), s.errors)
        self.assertIsNone(s.validated_data["drop_stop"])

    def test_accepted_request_persists_real_stops(self):
        """End-to-end through the service: fare-bearing fields must be set."""
        s = self._serialize(self.first_stop, self.second_stop)
        self.assertTrue(s.is_valid(), s.errors)
        req = BoardingService.create_request(
            passenger=self.passenger,
            trip=s.validated_data["trip"],
            pickup_stop=s.validated_data["pickup_stop"],
            drop_stop=s.validated_data["drop_stop"],
        )
        req.refresh_from_db()
        self.assertEqual(req.status, BOARDING_PENDING)
        self.assertEqual(req.pickup_stop_id, self.first_stop.id)
        self.assertEqual(req.drop_stop_id, self.second_stop.id)

    def test_unknown_stop_id_errors_instead_of_silently_zero_faring(self):
        """A bad drop id must not become None and price the ride at 0.0."""
        s = BoardingRequestCreateSerializer(data={
            "trip": str(self.trip.id),
            "pickup_stop": str(self.first_stop.id),
            "drop_stop": "00000000-0000-0000-0000-000000000000",
        })
        self.assertFalse(s.is_valid())
        self.assertIn("drop_stop", s.errors)


class StopFactory:
    """Minimal helper so the test file stays readable."""

    @classmethod
    def create(cls, name, lng, lat):
        return Stop.objects.create(
            name=name,
            location=Point(lng, lat, srid=4326),
            route=None,
            is_global=True,
        )