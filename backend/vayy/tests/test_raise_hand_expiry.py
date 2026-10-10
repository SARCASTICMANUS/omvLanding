"""
A pending hand-raise must stop blocking once it has run out of time.

A broadcast request lives 45 seconds. Nothing sweeps expired rows back to
``expired`` unless the beat scheduler happens to be running, and the duplicate
guard in ``PassengerRaiseHandView._raise_hand_on_stop`` used to look only at
``status=pending``. So an abandoned request sat at ``pending`` indefinitely and
every later attempt by that passenger returned:

    409 "You already have a pending request at this stop"

forever. The guard now compares ``expires_at`` and retires the dead rows on the
way past.
"""

from datetime import timedelta

from django.contrib.gis.geos import Point
from django.test import TestCase
from django.urls import reverse
from django.utils import timezone
from rest_framework.test import APIClient

from accounts.models import PublicDriverProfile, User
from operations.models import (
    ActiveTrip,
    DispatchRequest,
    Vehicle,
    VehicleState,
)
from operations.services.journey_service import JourneyService
from transport.models import Stop

ORIGIN = (26.8000, 80.9000)
DESTINATION = (26.9000, 80.9000)


def _fake_osrm():
    return {
        "distance": 11100.0,
        "duration": 1320.0,
        "geometry": {
            "type": "LineString",
            "coordinates": [
                [80.9000, ORIGIN[0] + (DESTINATION[0] - ORIGIN[0]) * (i / 10)]
                for i in range(11)
            ],
        },
    }


class RaiseHandExpiryTests(TestCase):
    def setUp(self):
        self.client = APIClient()

        self.driver = User.objects.create_user(
            email="exp-driver", password="x", role="autodriver"
        )
        PublicDriverProfile.objects.create(user=self.driver, display_name="Ravi")
        self.passenger = User.objects.create_user(
            email="exp-passenger", password="x", role="passenger"
        )
        self.vehicle = Vehicle.objects.create(
            vehicle_number="EXP-1", vehicle_type="auto", driver=self.driver
        )
        VehicleState.objects.create(
            vehicle=self.vehicle,
            current_location=Point(ORIGIN[1], ORIGIN[0], srid=4326),
        )
        self.stop = Stop.objects.create(
            name="Corridor Stop",
            location=Point(ORIGIN[1], ORIGIN[0], srid=4326),
            route=None,
            is_global=True,
            order=0,
        )
        Stop.objects.create(
            name="Corridor End",
            location=Point(DESTINATION[1], DESTINATION[0], srid=4326),
            route=None,
            is_global=True,
            order=1,
        )

        from unittest.mock import patch

        with patch(
            "transport.services.osrm_service.OSRMService.get_road_path",
            return_value=_fake_osrm(),
        ):
            JourneyService.start_journey(
                driver=self.driver,
                vehicle_id=str(self.vehicle.id),
                origin=ORIGIN,
                destination=DESTINATION,
                origin_name="Origin",
                destination_name="Destination",
            )
        self.trip = ActiveTrip.objects.get(vehicle=self.vehicle, status="active")

    def _raise(self):
        self.client.force_authenticate(user=self.passenger)
        return self.client.post(
            reverse("passenger-raise-hand"),
            {"pickup_stop_id": str(self.stop.id), "lat": ORIGIN[0], "lng": ORIGIN[1]},
            format="json",
        )

    def _expired_request(self):
        req = DispatchRequest.objects.create(
            passenger=self.passenger,
            pickup_stop=self.stop,
            status=DispatchRequest.STATUS_PENDING,
            expires_at=timezone.now() - timedelta(minutes=5),
        )
        return req

    def test_a_live_pending_request_still_blocks(self):
        """The guard must not be loosened into letting duplicates through."""
        DispatchRequest.objects.create(
            passenger=self.passenger,
            pickup_stop=self.stop,
            status=DispatchRequest.STATUS_PENDING,
            expires_at=timezone.now() + timedelta(seconds=30),
        )
        res = self._raise()
        self.assertEqual(res.status_code, 409, res.data)
        self.assertIn("already have a pending request", res.data["message"])

    def test_an_expired_request_does_not_block(self):
        stale = self._expired_request()
        res = self._raise()

        self.assertNotEqual(
            res.status_code, 409, f"expired request {stale.id} still blocked the rider"
        )
        stale.refresh_from_db()
        self.assertEqual(stale.status, DispatchRequest.STATUS_EXPIRED)

    def test_two_raises_in_a_row_both_succeed(self):
        """The regression as a rider sees it: retry after the window passed."""
        self._expired_request()
        first = self._raise()
        self.assertNotEqual(first.status_code, 409)

        # Expire whatever the first raise created, then raise again.
        DispatchRequest.objects.filter(
            passenger=self.passenger, status=DispatchRequest.STATUS_PENDING
        ).update(
            status=DispatchRequest.STATUS_EXPIRED,
            expires_at=timezone.now() - timedelta(seconds=1),
        )
        second = self._raise()
        self.assertNotEqual(second.status_code, 409, second.data)
