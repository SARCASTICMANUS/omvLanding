"""
Resuming a driver's in-progress journey.

The app asks "does this driver have a live journey?" after a cold start, when the
trip id was only ever in memory. The important cases are: no journey, a journey
whose cache still exists, and a journey whose cache is gone.
"""

from django.contrib.auth import get_user_model
from django.test import TestCase
from django.urls import resolve
from rest_framework.test import APIClient
from rest_framework_simplejwt.tokens import RefreshToken

from operations.models import ActiveTrip, Vehicle
from operations.services.journey_service import JourneyService


class ActiveJourneyLookupTests(TestCase):
    def setUp(self):
        User = get_user_model()
        self.driver = User.objects.create(
            username="resume-driver@test.local",
            email="resume-driver@test.local",
            role="bikedriver",
        )
        self.other = User.objects.create(
            username="resume-other@test.local",
            email="resume-other@test.local",
            role="bikedriver",
        )
        self.vehicle = Vehicle.objects.create(
            vehicle_number="RESUME-1",
            vehicle_type="bike",
            driver=self.driver,
        )

    def _active_trip(self, **kwargs):
        # route=None means a journey; a caller may override it to build the
        # legacy fixed-route trip instead.
        kwargs.setdefault("route", None)
        kwargs.setdefault("status", "active")
        return ActiveTrip.objects.create(
            driver=kwargs.pop("driver", self.driver),
            vehicle=kwargs.pop("vehicle", self.vehicle),
            **kwargs,
        )

    def test_none_when_no_journey(self):
        self.assertIsNone(
            JourneyService.get_active_journey_for_driver(self.driver)
        )

    def test_none_for_a_passenger(self):
        User = get_user_model()
        pax = User.objects.create(
            username="resume-pax@test.local",
            email="resume-pax@test.local",
            role="passenger",
        )
        self.assertIsNone(JourneyService.get_active_journey_for_driver(pax))

    def test_finds_the_active_journey_row(self):
        trip = self._active_trip()
        found = JourneyService.get_active_journey_for_driver(self.driver)
        # Cache is absent in this test, so this is the degraded shape; the trip
        # id must still be right or the app cannot resume.
        self.assertIsNotNone(found)
        self.assertEqual(found["trip_id"], str(trip.id))
        self.assertTrue(found["degraded"])

    def test_never_another_drivers_journey(self):
        self._active_trip(driver=self.other)
        self.assertIsNone(JourneyService.get_active_journey_for_driver(self.driver))

    def test_completed_journey_is_not_active(self):
        self._active_trip(status="completed")
        self.assertIsNone(
            JourneyService.get_active_journey_for_driver(self.driver)
        )

    def test_a_fixed_route_trip_is_not_a_journey(self):
        # The legacy route flow must not be reported as a journey, or a driver
        # on a scheduled route gets pulled onto the journey screen.
        from transport.models import City, Route
        from django.contrib.gis.geos import LineString

        route = Route.objects.create(
            name="Legacy R1",
            route_code="R1",
            city=City.objects.create(name="ResumeCity"),
            path=LineString((80.9, 26.8), (81.0, 26.9)),
        )
        self._active_trip(route=route)
        self.assertIsNone(
            JourneyService.get_active_journey_for_driver(self.driver)
        )

    def test_most_recent_wins_when_several_are_open(self):
        older = self._active_trip()
        newer = self._active_trip()
        found = JourneyService.get_active_journey_for_driver(self.driver)
        self.assertEqual(found["trip_id"], str(newer.id))
        self.assertNotEqual(found["trip_id"], str(older.id))

    def test_payload_carries_vehicle_identity(self):
        # The live screen keys its GPS push on vehicle_id. A resumed driver
        # without it sits on the live screen silently sending no location, and
        # stops never see the vehicle.
        self._active_trip()
        found = JourneyService.get_active_journey_for_driver(self.driver)
        self.assertEqual(found["vehicle_id"], str(self.vehicle.id))
        self.assertEqual(found["vehicle_number"], "RESUME-1")
        self.assertEqual(found["vehicle_type"], "bike")

    def test_degraded_payload_has_the_keys_the_app_reads(self):
        self._active_trip()
        found = JourneyService.get_active_journey_for_driver(self.driver)
        for key in ("trip_id", "status", "path", "stops", "vehicle_id"):
            self.assertIn(key, found)
        # Absent cache must read as empty, not missing, so the live screen can
        # render without guarding each access.
        self.assertEqual(found["path"], [])
        self.assertEqual(found["stops"], [])


class ActiveJourneyAPITests(TestCase):
    def setUp(self):
        User = get_user_model()
        self.driver = User.objects.create(
            username="resume-api@test.local",
            email="resume-api@test.local",
            role="bikedriver",
        )
        self.vehicle = Vehicle.objects.create(
            vehicle_number="RESUME-API",
            vehicle_type="bike",
            driver=self.driver,
        )
        # This API is JWT-only, so a session login would 401. Authenticate the
        # way the app does.
        self.client = APIClient()
        token = RefreshToken.for_user(self.driver).access_token
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {token}")

    def test_returns_null_data_when_idle(self):
        response = self.client.get("/api/tracking/journeys/active/")
        self.assertEqual(response.status_code, 200)
        body = response.json()
        # "No journey" is the common case and must not look like an error.
        self.assertTrue(body["success"])
        self.assertIsNone(body["data"])

    def test_route_is_not_shadowed_by_the_trip_id_route(self):
        # journeys/active/ must not be captured by journeys/<uuid:trip_id>/.
        match = resolve("/api/tracking/journeys/active/")
        self.assertEqual(match.func.cls.__name__, "ActiveJourneyAPIView")
        self.assertEqual(match.kwargs, {})

    def test_requires_authentication(self):
        self.assertEqual(
            APIClient().get("/api/tracking/journeys/active/").status_code, 401
        )