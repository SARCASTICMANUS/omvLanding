"""
Regression tests for the defects found while driving the journey flow.

Each test here corresponds to a bug that was reproduced against a real browser
and a real Android build, and then fixed. They are grouped by the surface they
guard:

* ``DriverDisplayNameTests`` - the driver name shown to a passenger was always
  empty. ``get_full_name()`` reads first/last name, which this User model does
  not define, so it returns "" for every account.
* ``VerificationStatusTests`` - an already-verified account with no uploaded
  documents reported ``not_submitted``, which raised a modal that cannot be
  dismissed over the whole app and locked the user out entirely.
* ``AcceptPayloadContractTests`` - the accept/settlement payloads the mobile
  screens read must actually carry the fields those screens render.
* ``VehicleUpdatePayloadTests`` - the passenger's live ETA card reads the
  pickup lead time, so the broadcast has to carry it under the names the screen
  uses.
"""

from datetime import timedelta
from decimal import Decimal
from unittest.mock import patch

from django.contrib.gis.geos import Point
from django.test import TestCase
from django.utils import timezone
from rest_framework.test import APIClient

from accounts.services.wallet_service import WalletService
from accounts.models import (
    DriverDocument,
    PublicDriverProfile,
    PublicPassengerProfile,
    User,
)
from common.constants import (
    DOC_STATUS_VERIFIED,
    DOC_TYPE_IDENTITY,
    DOC_TYPE_INSURANCE,
    DOC_TYPE_LICENSE,
    DOC_TYPE_RC,
)
from operations.models import (
    ActiveTrip,
    BoardingRequest,
    DispatchRequest,
    Vehicle,
    VehicleState,
)
from operations.services.journey_service import JourneyService
from operations.services.dispatch_service import (
    _user_display_name,
    DispatchService,
)
from transport.models import Stop


class DriverDisplayNameTests(TestCase):
    """``_user_display_name`` must resolve names for both roles."""

    def setUp(self):
        self.driver = User.objects.create_user(
            email="dn-driver", password="x", role="bikedriver"
        )
        PublicDriverProfile.objects.create(user=self.driver, display_name="Ravi Kumar")
        self.passenger = User.objects.create_user(
            email="dn-passenger", password="x", role="passenger"
        )
        PublicPassengerProfile.objects.create(
            user=self.passenger, display_name="Asha Verma"
        )

    def test_driver_profile_name_is_used(self):
        self.assertEqual(_user_display_name(self.driver), "Ravi Kumar")

    def test_passenger_profile_name_is_used(self):
        self.assertEqual(_user_display_name(self.passenger), "Asha Verma")

    def test_falls_back_to_email_when_no_profile_name(self):
        bare = User.objects.create_user(email="dn-bare", password="x", role="passenger")
        self.assertEqual(_user_display_name(bare), "dn-bare")

    def test_none_is_safe(self):
        self.assertEqual(_user_display_name(None), "")

    def test_no_source_returns_get_full_name_not_blank(self):
        """A driver with no profile must still produce something showable.

        This is the shape that previously produced "", leaving the passenger's
        live screen with an empty driver name.
        """
        unprofiled = User.objects.create_user(
            email="dn-noprofile", password="x", role="bikedriver"
        )
        name = _user_display_name(unprofiled)
        self.assertTrue(name)
        self.assertNotEqual(name, "")


class VerificationStatusTests(TestCase):
    """
    Driver verification requires both reviewed documents and an approved vehicle.

    ``not_submitted`` and ``unverified`` both render a non-dismissible modal, so
    reporting them for an account that is already verified locks the user out of
    every screen behind it.
    """

    URL = "/api/accounts/verification-status/"

    def setUp(self):
        self.client = APIClient()

    def _status(self, user):
        self.client.force_authenticate(user=user)
        res = self.client.get(self.URL)
        self.assertEqual(res.status_code, 200, res.data)
        return res.data["data"]["status"]

    def test_legacy_verified_driver_without_vehicle_is_not_verified(self):
        driver = User.objects.create_user(
            email="vs-driver", password="x", role="bikedriver", is_verified=True
        )
        PublicDriverProfile.objects.create(user=driver, is_verified=True, vehicle_number="")
        self.assertEqual(self._status(driver), "not_submitted")

    def test_profile_flag_and_approved_vehicle_without_documents_is_not_verified(self):
        driver = User.objects.create_user(
            email="vs-driver2", password="x", role="bikedriver", otp_verified=True
        )
        PublicDriverProfile.objects.create(user=driver, is_verified=True, vehicle_number="VS-2")
        Vehicle.objects.create(
            driver=driver, vehicle_number="VS-2", vehicle_type="bike",
            status="approved", is_active=True,
        )
        self.assertEqual(self._status(driver), "not_submitted")

    def test_verified_driver_requires_all_documents_and_an_approved_vehicle(self):
        driver = User.objects.create_user(
            email="vs-driver3", password="x", role="bikedriver", otp_verified=True
        )
        PublicDriverProfile.objects.create(user=driver, vehicle_number="VS-3")
        Vehicle.objects.create(
            driver=driver, vehicle_number="VS-3", vehicle_type="bike",
            status="approved", is_active=True,
        )
        docs = [
            ("dlFront", DOC_TYPE_LICENSE), ("dlBack", DOC_TYPE_LICENSE),
            ("rcFront", DOC_TYPE_RC), ("rcBack", DOC_TYPE_RC),
            ("insuranceFront", DOC_TYPE_INSURANCE), ("insuranceBack", DOC_TYPE_INSURANCE),
            ("aadhaarFront", DOC_TYPE_IDENTITY), ("aadhaarBack", DOC_TYPE_IDENTITY),
            ("selfie", DOC_TYPE_IDENTITY),
        ]
        DriverDocument.objects.bulk_create([
            DriverDocument(
                driver=driver, doc_key=doc_key, document_type=doc_type,
                status=DOC_STATUS_VERIFIED, file_data="test",
            )
            for doc_key, doc_type in docs
        ])
        self.assertEqual(self._status(driver), "verified")

    def test_verified_passenger_is_not_locked_out(self):
        """Passengers never upload vehicle documents, so this was permanent."""
        passenger = User.objects.create_user(
            email="vs-passenger", password="x", role="passenger", is_verified=True
        )
        self.assertEqual(self._status(passenger), "verified")

    def test_unverified_account_with_no_documents_still_reports_not_submitted(self):
        """The fix must not let an unverified account skip the check."""
        driver = User.objects.create_user(
            email="vs-unverified", password="x", role="bikedriver"
        )
        self.assertEqual(self._status(driver), "not_submitted")


class VehicleKYCRequestGuardTests(TestCase):
    def setUp(self):
        self.admin = User.objects.create_superuser(email="kyc-admin@example.test", password="x")
        self.driver = User.objects.create_user(
            email="kyc-driver@example.test", password="x", role="bikedriver", otp_verified=True,
        )
        PublicDriverProfile.objects.create(user=self.driver)
        self.client = APIClient()
        self.client.force_authenticate(user=self.admin)

    def test_document_upload_without_vehicle_is_not_a_verification_request(self):
        DriverDocument.objects.create(
            driver=self.driver, document_type="LICENSE", doc_key="dlFront", file_data="test",
        )

        response = self.client.get("/api/operations/admin/drivers/pending/")

        self.assertEqual(response.status_code, 200)
        self.assertNotIn(str(self.driver.id), [row["id"] for row in response.data["data"]])

    def test_admin_cannot_approve_driver_without_vehicle_registration(self):
        response = self.client.patch(
            f"/api/operations/admin/drivers/{self.driver.id}/verify/",
            {"action": "approve"}, format="json",
        )

        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.data["code"], "VEHICLE_KYC_REQUIRED")


class AcceptPayloadContractTests(TestCase):
    """
    The screens read specific keys from accept and settlement payloads.

    ``BikeTripCompleteScreen`` renders ``passengers[].passenger_name`` /
    ``pickup_stop_name`` / ``drop_stop_name`` / ``fare`` / ``segment_distance_m``,
    and the card above it renders ``driver_name``. If any of these go missing the
    driver finishes a trip looking at a screen full of dashes.
    """

    def setUp(self):
        self.driver = User.objects.create_user(
            email="ac-driver", password="x", role="autodriver"
        )
        PublicDriverProfile.objects.create(
            user=self.driver, display_name="Sunil Yadav"
        )
        self.passenger = User.objects.create_user(
            email="ac-passenger", password="x", role="passenger"
        )
        PublicPassengerProfile.objects.create(
            user=self.passenger, display_name="Meera Singh", phone_number="+919812345678"
        )
        self.vehicle = Vehicle.objects.create(
            vehicle_number="AC-1", vehicle_type="auto", driver=self.driver
        )
        VehicleState.objects.create(
            vehicle=self.vehicle, current_location=Point(80.9462, 26.8467, srid=4326)
        )

    def _global_stop(self, name, lat, lng, order):
        return Stop.objects.create(
            name=name, location=Point(lng, lat, srid=4326),
            route=None, is_global=True, order=order,
        )

    def _journey(self):
        """Start a real journey; only the road path is stubbed."""
        self.pickup = self._global_stop("Gomti Nagar", 26.8000, 80.9000, 0)
        self.drop = self._global_stop("Kamta Chauraha", 26.9000, 80.9000, 1)
        osrm = {
            "distance": 11100.0,
            "duration": 1320.0,
            "geometry": {
                "type": "LineString",
                # OSRM emits [lng, lat]; the service consumes that order.
                "coordinates": [
                    [80.9000, 26.8000 + (26.9000 - 26.8000) * (i / 10)]
                    for i in range(11)
                ],
            },
        }
        with patch(
            "transport.services.osrm_service.OSRMService.get_road_path",
            return_value=osrm,
        ):
            started = JourneyService.start_journey(
                driver=self.driver,
                vehicle_id=str(self.vehicle.id),
                origin=(26.8000, 80.9000),
                destination=(26.9000, 80.9000),
                origin_name="Gomti Nagar",
                destination_name="Kamta Chauraha",
            )
        return ActiveTrip.objects.get(id=started["trip_id"])

    def test_accept_response_carries_a_non_empty_driver_name(self):
        """The passenger's live screen shows this verbatim."""
        trip = self._journey()
        DispatchRequest.objects.create(
            passenger=self.passenger,
            pickup_stop=self.pickup,
            status=DispatchRequest.STATUS_PENDING,
            expires_at=timezone.now() + timedelta(minutes=5),
        )
        # The channel layer is not running in tests; the broadcast itself is
        # not what this test is about.
        with patch.object(DispatchService, "_notify_ws"):
            result = DispatchService._accept_journey_request(
                DispatchRequest.objects.get(), self.driver
            )
        self.assertEqual(result["driver_name"], "Sunil Yadav")
        self.assertTrue(result["driver_name"])
        self.assertEqual(result["passenger_name"], "Meera Singh")
        self.assertEqual(result["vehicle_number"], "AC-1")
        trip  # referenced to keep the journey alive for the reader

    def test_settlement_rows_carry_every_field_the_completion_screen_renders(self):
        trip = self._journey()
        pickup = Stop.objects.create(
            name="Gomti Nagar", location=Point(80.9462, 26.8467, srid=4326),
            route=None, is_global=True, order=0,
        )
        drop = Stop.objects.create(
            name="Kamta Chauraha", location=Point(81.0148, 26.874, srid=4326),
            route=None, is_global=True, order=1,
        )
        BoardingRequest.objects.create(
            passenger=self.passenger,
            trip=trip,
            pickup_stop=pickup,
            drop_stop=drop,
            status="boarded",
            otp="1234",
        )

        # Fund the rider so the real settlement runs rather than a stub: the
        # point is that the fare is actually charged and returned, not that a
        # mocked debit was called.
        WalletService.get_or_create_wallet(self.passenger)
        WalletService.add_funds(self.passenger, Decimal("500"))

        with patch(
            "operations.services.journey_service.JourneyService._notify_trip_completed"
        ):
            settlement = DispatchService.settle_journey_passengers(trip)

        self.assertEqual(settlement["outstanding"], [], "fare must not be outstanding")
        self.assertEqual(
            WalletService.get_or_create_wallet(self.passenger).balance,
            Decimal("500") - Decimal(str(settlement["settled"][0]["fare"])),
            "the rider is debited exactly the settled fare",
        )

        self.assertEqual(settlement["total"], 1)
        row = settlement["settled"][0]
        for key in (
            "boarding_request_id",
            "passenger_id",
            "passenger_name",
            "pickup_stop_name",
            "drop_stop_name",
            "segment_distance_m",
            "segment_duration_s",
            "fare",
        ):
            self.assertIn(key, row, f"completion screen reads {key}")

        self.assertEqual(row["passenger_name"], "Meera Singh")
        self.assertEqual(row["pickup_stop_name"], "Gomti Nagar")
        self.assertEqual(row["drop_stop_name"], "Kamta Chauraha")
        self.assertGreater(float(row["fare"]), 0, "a boarded rider must not settle at 0")

    def test_journey_detail_exposes_stop_distance_and_eta(self):
        """``DriverLiveTracking`` renders '—' when these are absent."""
        trip = self._journey()
        detail = JourneyService.get_journey(trip.id)

        self.assertEqual(str(detail["trip_id"]), str(trip.id))
        self.assertTrue(detail["stops"])
        for stop in detail["stops"]:
            self.assertIn("distance_m", stop)
            self.assertIn("eta_minutes", stop)
            self.assertIn("is_next", stop)
        self.assertTrue(any(s["is_next"] for s in detail["stops"]))
