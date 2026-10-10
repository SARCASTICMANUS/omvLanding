"""
Journey preview: resolve a road and its stops without starting a journey.

The point of preview is that it is free of side effects, so the tests assert
the absence of state as hard as they assert the returned path.

`_build_path` is patched with `mock.patch.object` rather than by assigning to
the class. Assigning permanently would leak into every later test in the same
process and silently break the journey suite that depends on real OSRM calls.
"""

from contextlib import contextmanager
from unittest import mock

from django.contrib.auth import get_user_model
from django.test import TestCase

from operations.models import ActiveTrip
from operations.services.journey_service import JourneyService
from tracking.api.serializers import PreviewJourneySerializer

# Two points far enough apart to clear the 100 m minimum, as (lng, lat) because
# that is the order _build_path's caller works in.
OSRM_LINE = [[80.85, 26.73], [80.93, 26.80], [81.01, 26.87]]


@contextmanager
def stubbed_path(distance=1500.0, duration=180.0):
    """Replace OSRM resolution for the duration of the block, then restore it."""
    coords_latlng = [[lat, lng] for lng, lat in OSRM_LINE]

    def fake(cls, origin, destination):
        return coords_latlng, distance, duration

    with mock.patch.object(JourneyService, "_build_path", classmethod(fake)):
        yield


@contextmanager
def unroutable():
    with mock.patch.object(
        JourneyService, "_build_path", classmethod(lambda cls, origin, destination: None)
    ):
        yield


class PreviewJourneyServiceTests(TestCase):
    def setUp(self):
        User = get_user_model()
        self.driver = User.objects.create(
            username="preview-driver@test.local",
            email="preview-driver@test.local",
            role="bikedriver",
        )

    def preview(self):
        return JourneyService.preview_journey(
            driver=self.driver, origin=(26.73, 80.85), destination=(26.87, 81.01)
        )

    def test_returns_path_distance_and_stops(self):
        with stubbed_path():
            result = self.preview()
        # Path is [lat, lng] for the clients, matching start_journey.
        self.assertEqual(result["path"][0], [26.73, 80.85])
        self.assertEqual(result["path"][-1], [26.87, 81.01])
        self.assertIn("stops", result)
        self.assertEqual(result["distance_m"], 1500.0)
        self.assertEqual(result["duration_s"], 180.0)

    def test_echoes_both_endpoints(self):
        with stubbed_path():
            result = self.preview()
        self.assertEqual(result["origin"], {"lat": 26.73, "lng": 80.85})
        self.assertEqual(result["destination"], {"lat": 26.87, "lng": 81.01})

    def test_creates_no_trip(self):
        with stubbed_path():
            self.preview()
        # The whole point: previewing must not create a live trip.
        self.assertEqual(ActiveTrip.objects.count(), 0)

    def test_twice_in_a_row_is_stable_and_still_creates_nothing(self):
        # Safe to call on every edit, so repeated previews must not accumulate
        # state or differ.
        with stubbed_path():
            first = self.preview()
            second = self.preview()
        self.assertEqual(first["path"], second["path"])
        self.assertEqual(first["stops"], second["stops"])
        self.assertEqual(ActiveTrip.objects.count(), 0)

    def test_restores_the_real_path_builder(self):
        # Guards the leak that patching by assignment would cause.
        original = JourneyService.__dict__["_build_path"]
        with stubbed_path():
            self.assertIsNot(JourneyService.__dict__["_build_path"], original)
        self.assertIs(JourneyService.__dict__["_build_path"], original)

    def test_rejects_non_driver(self):
        from rest_framework.exceptions import PermissionDenied

        User = get_user_model()
        passenger = User.objects.create(
            username="preview-pax@test.local",
            email="preview-pax@test.local",
            role="passenger",
        )
        with stubbed_path():
            with self.assertRaises(PermissionDenied):
                JourneyService.preview_journey(
                    driver=passenger,
                    origin=(26.73, 80.85),
                    destination=(26.87, 81.01),
                )

    def test_rejects_too_close_endpoints(self):
        from rest_framework.exceptions import ValidationError

        with stubbed_path():
            with self.assertRaises(ValidationError):
                JourneyService.preview_journey(
                    driver=self.driver,
                    origin=(26.7300, 80.8500),
                    destination=(26.7301, 80.8501),
                )

    def test_rejects_out_of_range_coordinates(self):
        from rest_framework.exceptions import ValidationError

        with stubbed_path():
            with self.assertRaises(ValidationError):
                JourneyService.preview_journey(
                    driver=self.driver,
                    origin=(999.0, 80.85),
                    destination=(26.87, 81.01),
                )

    def test_fails_when_path_cannot_be_resolved(self):
        # Same posture as start_journey: no straight-line fallback, because the
        # geometry is the journey.
        from rest_framework.exceptions import ValidationError

        with unroutable():
            with self.assertRaises(ValidationError):
                self.preview()


class PreviewJourneySerializerTests(TestCase):
    def test_requires_origin_and_destination_only(self):
        s = PreviewJourneySerializer(
            data={"origin": {"lat": 26.73, "lng": 80.85},
                  "destination": {"lat": 26.87, "lng": 81.01}}
        )
        self.assertTrue(s.is_valid(), s.errors)

    def test_no_vehicle_required(self):
        # Preview must be callable before a vehicle check, since it creates
        # nothing; a vehicle_id field would make it useless for that purpose.
        s = PreviewJourneySerializer(
            data={"origin": {"lat": 26.73, "lng": 80.85},
                  "destination": {"lat": 26.87, "lng": 81.01}}
        )
        self.assertTrue(s.is_valid(), s.errors)
        self.assertNotIn("vehicle_id", s.validated_data)

    def test_missing_destination_is_rejected(self):
        s = PreviewJourneySerializer(data={"origin": {"lat": 26.73, "lng": 80.85}})
        self.assertFalse(s.is_valid())
        self.assertIn("destination", s.errors)