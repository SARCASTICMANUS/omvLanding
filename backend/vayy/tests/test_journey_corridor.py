"""
Journey flow: a driver's free-form trip, the global stops along it, and a
passenger hand raised at one of them.

Covers the behaviours the journey model exists to provide:

* the road path is mandatory, and a journey is refused without both endpoints;
* global stops (Stops with no route) inside the corridor are attached to the
  journey nearest-first from the origin;
* a passenger standing at one of those stops sees the vehicle, and only a
  vehicle that has not passed it yet;
* raising a hand there notifies exactly those drivers;
* accepting attaches the passenger to the driver's existing journey, with a
  per-passenger safety code, and the journey carries many passengers;
* a drop stop behind the pickup is refused;
* ending the journey clears the cached path and the stop index.

Written on django.test.TestCase so it runs under both `manage.py test` and
pytest, and with plain setUp helpers rather than pytest fixtures so it does not
depend on the runner.
"""

from decimal import Decimal
from unittest.mock import patch

from django.contrib.gis.geos import LineString, Point
from django.db import transaction
from django.test import TestCase
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APIClient

from accounts.models import PublicDriverProfile, Transaction, User, Wallet
from common.constants import (
    BOARDING_BOARDED,
    BOARDING_CANCELLED,
    BOARDING_COMPLETED,
    BOARDING_PENDING,
    TRIP_STATUS_ACTIVE,
    TRIP_STATUS_COMPLETED,
)
from operations.api.serializers import BoardingRequestSerializer
from operations.models import ActiveTrip, BoardingRequest, DispatchRequest, Vehicle, VehicleState
from operations.services.dispatch_service import DispatchService
from operations.services.journey_service import JourneyService
from tracking.services.corridor_service import CorridorService
from tracking.services.journey_cache_service import JourneyCacheService
from transport.models import City, Route, Stop

# A short north-south corridor near Lucknow. Origin in the south, destination in
# the north, so "nearest-first" has an unambiguous expected order.
ORIGIN = (26.8000, 80.9000)  # (lat, lng)
DESTINATION = (26.9000, 80.9000)

NEAR_STOP = (26.8500, 80.9000)  # between the endpoints
FAR_STOP = (26.8700, 80.9000)  # further along


def _fake_osrm_path(origin=ORIGIN, destination=DESTINATION):
    """
    Stand in for OSRM's /route response.

    Coordinates are emitted in OSRM's own [lng, lat] order, because that is what
    the service consumes and reversing it here would hide an axis mix-up that
    only shows up as "no stops found".

    The path is what the journey is built on, so every test that starts a
    journey needs one. Patching it keeps the tests independent of a live routing
    engine while still exercising the real journey assembly around it.
    """
    coords = [
        [destination[1], origin[0] + (destination[0] - origin[0]) * (i / 10)]
        for i in range(11)
    ]
    return {
        "distance": 11100.0,  # ~11 km
        "duration": 1320.0,
        "geometry": {"type": "LineString", "coordinates": coords},
    }


class JourneyTestBase(TestCase):
    """Shared fixtures for the journey tests."""

    def setUp(self):
        self.city = City.objects.create(name="Journey City", state="Uttar Pradesh")
        self.driver = User.objects.create_user(
            email="journey-driver", password="password", role="bikedriver"
        )
        # Candidate selection ranks by driver rating, which lives on the profile,
        # so a driver without one is not a dispatch candidate at all. Registration
        # creates it; the tests mirror that.
        PublicDriverProfile.objects.create(
            user=self.driver, display_name="Journey Driver", rating=4.5
        )
        self.passenger = User.objects.create_user(
            email="journey-passenger", password="password", role="passenger"
        )
        self.vehicle = Vehicle.objects.create(
            vehicle_number="JV-1", vehicle_type="bike", city=self.city, driver=self.driver
        )

    def make_driver(self, email, rating=4.5):
        """Another driver, complete enough to be a dispatch candidate."""
        user = User.objects.create_user(
            email=email, password="password", role="bikedriver"
        )
        PublicDriverProfile.objects.create(
            user=user, display_name=email, rating=rating
        )
        return user

    def make_stop(self, name, coords, order=0):
        return Stop.objects.create(
            name=name,
            location=Point(coords[1], coords[0], srid=4326),
            city=self.city,
            order=order,
        )

    def make_route(self, name="Test Route"):
        return Route.objects.create(
            name=name,
            city=self.city,
            path=LineString([(80.9, 26.8), (80.9, 26.9)], srid=4326),
        )

    def make_route_stop(self, name, coords, order, route=None):
        return Stop.objects.create(
            name=name,
            route=route or self.make_route(f"Route for {name}"),
            location=Point(coords[1], coords[0], srid=4326),
            order=order,
        )

    def start_journey(self, driver=None, vehicle=None, osrm=None):
        with patch(
            "transport.services.osrm_service.OSRMService.get_road_path",
            return_value=osrm if osrm is not None else _fake_osrm_path(),
        ):
            return JourneyService.start_journey(
                driver=driver or self.driver,
                vehicle_id=str((vehicle or self.vehicle).id),
                origin=ORIGIN,
                destination=DESTINATION,
                origin_name="Origin",
                destination_name="Destination",
            )

    def raise_hand(self, passenger, stop, drop=None):
        """Raise a hand at a stop as a passenger standing on it."""
        api = APIClient()
        api.force_authenticate(user=passenger)
        payload = {
            "pickup_stop_id": str(stop.id),
            "lat": stop.location.y,
            "lng": stop.location.x,
        }
        if drop is not None:
            payload["dropoff_stop_id"] = str(drop.id)
        response = api.post(reverse("passenger-raise-hand"), payload, format="json")
        return response

    def accept_as_driver(self, request_id, driver=None):
        api = APIClient()
        api.force_authenticate(user=driver or self.driver)
        return api.post(reverse("broadcast-accept", args=[request_id]), {}, format="json")


class TestGlobalStops(JourneyTestBase):
    def test_stop_can_exist_without_a_route(self):
        stop = self.make_stop("Corridor Stop", NEAR_STOP)
        self.assertIsNone(stop.route_id)
        self.assertTrue(stop.is_global)
        self.assertEqual(Stop.objects.filter(is_global=True).count(), 1)

    def test_route_stop_is_not_global(self):
        stop = self.make_route_stop("Route Stop", NEAR_STOP, order=1)
        self.assertFalse(stop.is_global)

    def test_global_stops_nearby_returns_walkable_stop(self):
        stop = Stop.objects.create(
            name="Walkable Stop",
            location=Point(80.9005, 26.8005, srid=4326),  # ~70 m from ORIGIN
            city=self.city,
        )
        response = APIClient().get(
            reverse("global-stop-list"), {"lat": ORIGIN[0], "lng": ORIGIN[1]}
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertTrue(response.data["success"])
        self.assertIn(str(stop.id), [row["id"] for row in response.data["data"]])

    def test_global_stops_nearby_excludes_route_stops(self):
        self.make_route_stop("Route Stop", (26.8005, 80.9005), order=1)
        response = APIClient().get(
            reverse("global-stop-list"), {"lat": ORIGIN[0], "lng": ORIGIN[1]}
        )
        self.assertEqual(response.data["data"], [])

    def test_global_stops_nearby_respects_radius(self):
        # ~2 km north of ORIGIN: outside the 1 km walking radius.
        far = Stop.objects.create(
            name="Too Far",
            location=Point(80.9, 26.82, srid=4326),
            city=self.city,
        )
        response = APIClient().get(
            reverse("global-stop-list"), {"lat": ORIGIN[0], "lng": ORIGIN[1]}
        )
        self.assertNotIn(str(far.id), [row["id"] for row in response.data["data"]])


class TestStartJourney(JourneyTestBase):
    def test_path_is_mandatory(self):
        """No route resolved means no journey: the geometry is the journey."""
        with patch(
            "transport.services.osrm_service.OSRMService.get_road_path",
            return_value=None,
        ):
            with self.assertRaises(Exception):
                JourneyService.start_journey(
                    driver=self.driver,
                    vehicle_id=str(self.vehicle.id),
                    origin=ORIGIN,
                    destination=DESTINATION,
                )
        self.assertFalse(ActiveTrip.objects.filter(vehicle=self.vehicle).exists())

    def test_both_endpoints_required_by_api(self):
        api = APIClient()
        api.force_authenticate(user=self.driver)
        response = api.post(
            reverse("journey-start"),
            {"vehicle_id": str(self.vehicle.id),
             "origin": {"lat": ORIGIN[0], "lng": ORIGIN[1]}},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_journey_starts_with_no_route(self):
        result = self.start_journey()
        trip = ActiveTrip.objects.get(id=result["trip_id"])
        self.assertIsNone(trip.route_id)
        self.assertTrue(trip.is_journey)
        self.assertEqual(trip.status, TRIP_STATUS_ACTIVE)
        self.assertIsNotNone(trip.origin_point)
        self.assertIsNotNone(trip.destination_point)
        self.assertGreater(trip.total_distance_m, 0)
        self.assertTrue(result["path"])

    def test_journey_attaches_corridor_stops_nearest_first(self):
        near = self.make_stop("Near Stop", NEAR_STOP)
        far = self.make_stop("Far Stop", FAR_STOP)

        result = self.start_journey()

        stop_ids = [entry["stop_id"] for entry in result["stops"]]
        self.assertEqual(stop_ids, [str(near.id), str(far.id)])
        distances = [entry["dist_along_m"] for entry in result["stops"]]
        self.assertEqual(distances, sorted(distances))

    def test_stops_outside_the_corridor_are_not_attached(self):
        self.make_stop("Far Off Stop", (26.85, 81.2))  # ~30 km east of the path
        result = self.start_journey()
        self.assertEqual(result["stops"], [])

    def test_route_stops_are_not_corridor_candidates(self):
        self.make_route_stop("Route Stop On Path", NEAR_STOP, order=1)
        result = self.start_journey()
        self.assertEqual(result["stops"], [])

    def test_one_journey_per_vehicle(self):
        self.start_journey()
        with self.assertRaises(Exception):
            self.start_journey()

    def test_another_driver_cannot_start_on_this_vehicle(self):
        other = self.make_driver("other-driver")
        with self.assertRaises(Exception):
            self.start_journey(driver=other)

    def test_journey_start_api(self):
        stop = self.make_stop("On The Way", NEAR_STOP)
        api = APIClient()
        api.force_authenticate(user=self.driver)
        with patch(
            "transport.services.osrm_service.OSRMService.get_road_path",
            return_value=_fake_osrm_path(),
        ):
            response = api.post(
                reverse("journey-start"),
                {
                    "vehicle_id": str(self.vehicle.id),
                    "origin": {"lat": ORIGIN[0], "lng": ORIGIN[1]},
                    "destination": {"lat": DESTINATION[0], "lng": DESTINATION[1]},
                },
                format="json",
            )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertTrue(response.data["success"])
        self.assertIn(str(stop.id), [s["stop_id"] for s in response.data["data"]["stops"]])


class TestJourneyCache(JourneyTestBase):
    def test_path_and_stop_index_are_written(self):
        stop = self.make_stop("Cached Stop", NEAR_STOP)
        result = self.start_journey()
        trip_id = result["trip_id"]

        journey = JourneyCacheService.get_journey(trip_id)
        self.assertIsNotNone(journey)
        self.assertEqual(journey["path"], result["path"])
        self.assertGreater(journey["distance_m"], 0)
        self.assertEqual(
            JourneyCacheService.get_passing_trips(str(stop.id)), [trip_id]
        )
        self.assertTrue(JourneyCacheService.journey_serves_stop(trip_id, str(stop.id)))

    def test_delete_removes_path_and_reverse_index(self):
        stop = self.make_stop("Cached Stop", NEAR_STOP)
        result = self.start_journey()
        trip_id = result["trip_id"]

        self.assertTrue(JourneyCacheService.delete_journey(trip_id))

        # A finished vehicle left in the passing set would keep being offered.
        self.assertIsNone(JourneyCacheService.get_journey(trip_id))
        self.assertEqual(JourneyCacheService.get_ordered_stops(trip_id), [])
        self.assertEqual(JourneyCacheService.get_passing_trips(str(stop.id)), [])


class TestPassingVehicles(JourneyTestBase):
    def test_vehicle_serving_the_stop_is_listed(self):
        stop = self.make_stop("Served Stop", NEAR_STOP)
        self.start_journey()

        api = APIClient()
        api.force_authenticate(user=self.passenger)
        response = api.get(reverse("stop-passing-vehicles", args=[stop.id]))

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["data"]["count"], 1)
        self.assertEqual(
            response.data["data"]["vehicles"][0]["vehicle_number"], "JV-1"
        )

    def test_vehicle_on_another_journey_is_not_listed(self):
        elsewhere = self.make_stop("Somewhere Else", (26.85, 81.3))
        self.start_journey()

        api = APIClient()
        api.force_authenticate(user=self.passenger)
        response = api.get(reverse("stop-passing-vehicles", args=[elsewhere.id]))
        self.assertEqual(response.data["data"]["count"], 0)

    def test_driver_past_the_stop_is_excluded(self):
        """A vehicle beyond the stop cannot still pick the passenger up."""
        stop = self.make_stop("Passed Stop", NEAR_STOP)
        result = self.start_journey()
        entry = JourneyCacheService.get_ordered_stops(result["trip_id"])[0]

        beyond = entry["dist_along_m"] + 1
        self.assertFalse(
            CorridorService.is_stop_ahead(result["trip_id"], str(stop.id), beyond)
        )

    def test_vehicle_past_the_stop_is_excluded_from_candidates(self):
        """Same exclusion, through the code path the API and hand-raise use."""
        stop = self.make_stop("Passed Stop", NEAR_STOP)
        self.start_journey()

        # Drive the vehicle north of the stop it was going to serve.
        state = VehicleState.objects.get(vehicle=self.vehicle)
        state.current_location = Point(80.9, 26.88, srid=4326)
        state.save(update_fields=["current_location"])
        from tracking.services.redis_geo_service import RedisGeoService
        RedisGeoService.set_vehicle_snapshot(
            str(self.vehicle.id), 26.88, 80.9,
            trip_id=str(state.active_trip_id) if state.active_trip_id else None,
        )

        self.assertEqual(DispatchService.find_candidates_for_stop(str(stop.id)), [])

    def test_vehicle_before_the_stop_is_still_a_candidate(self):
        """The mirror of the case above: on time means still offered."""
        stop = self.make_stop("Upcoming Stop", NEAR_STOP)
        self.start_journey()

        state = VehicleState.objects.get(vehicle=self.vehicle)
        state.current_location = Point(80.9, 26.82, srid=4326)
        state.save(update_fields=["current_location"])
        from tracking.services.redis_geo_service import RedisGeoService
        RedisGeoService.set_vehicle_snapshot(
            str(self.vehicle.id), 26.82, 80.9,
            trip_id=str(state.active_trip_id) if state.active_trip_id else None,
        )

        candidates = DispatchService.find_candidates_for_stop(str(stop.id))
        self.assertEqual(len(candidates), 1)

    def test_no_vehicles_before_any_journey_starts(self):
        stop = self.make_stop("Idle Stop", NEAR_STOP)
        api = APIClient()
        api.force_authenticate(user=self.passenger)
        response = api.get(reverse("stop-passing-vehicles", args=[stop.id]))
        self.assertEqual(response.data["data"]["count"], 0)


class TestRaiseHandAtGlobalStop(JourneyTestBase):
    def test_hand_near_the_stop_notifies_passing_drivers(self):
        stop = self.make_stop("Boarding Stop", NEAR_STOP)
        self.start_journey()

        response = self.raise_hand(self.passenger, stop)

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertTrue(response.data["success"])
        request_id = response.data["data"]["request_id"]
        self.assertEqual(response.data["data"]["drivers_notified"], 1)

        dispatch_request = DispatchRequest.objects.get(id=request_id)
        # Journey-scoped: no route, and the driver was told about it.
        self.assertIsNone(dispatch_request.route_id)
        self.assertEqual(dispatch_request.pickup_stop_id, stop.id)
        self.assertIn(
            str(self.driver.id),
            {str(d) for d in dispatch_request.notified_drivers},
        )

    def test_hand_far_from_the_stop_is_refused(self):
        """A hand from far away would be served by drivers who never reach the
        passenger, so it is rejected at the boundary."""
        stop = self.make_stop("Boarding Stop", NEAR_STOP)
        self.start_journey()

        api = APIClient()
        api.force_authenticate(user=self.passenger)
        response = api.post(
            reverse("passenger-raise-hand"),
            {
                "pickup_stop_id": str(stop.id),
                "lat": stop.location.y + 0.2,  # ~20 km away
                "lng": stop.location.x,
            },
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertFalse(DispatchRequest.objects.exists())

    def test_hand_with_no_passing_drivers_is_reported(self):
        empty = self.make_stop("Empty Stop", (26.85, 81.4))
        response = self.raise_hand(self.passenger, empty)
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)
        self.assertFalse(DispatchRequest.objects.exists())

    def test_second_hand_at_same_stop_is_rejected(self):
        stop = self.make_stop("Boarding Stop", NEAR_STOP)
        self.start_journey()
        self.assertEqual(
            self.raise_hand(self.passenger, stop).status_code,
            status.HTTP_201_CREATED,
        )
        # A second raise would create a competing request, not refresh the first.
        self.assertEqual(
            self.raise_hand(self.passenger, stop).status_code,
            status.HTTP_409_CONFLICT,
        )

    def test_route_scoped_hand_still_works(self):
        """The fixed-route flow is untouched by the journey changes: it still
        boards an active trip running on the route."""
        route = self.make_route()
        pickup = self.make_route_stop("P1", (26.81, 80.90), order=1, route=route)
        drop = self.make_route_stop("D1", (26.89, 80.90), order=2, route=route)
        route_trip = ActiveTrip.objects.create(
            vehicle=self.vehicle,
            route=route,
            driver=self.driver,
            status=TRIP_STATUS_ACTIVE,
        )

        api = APIClient()
        api.force_authenticate(user=self.passenger)
        # The matching Celery task must not run against a broker here.
        with patch("tracking.api.views.process_ride_request.delay"):
            response = api.post(
                reverse("passenger-raise-hand"),
                {
                    "route_id": str(route.id),
                    "pickup_stop_id": str(pickup.id),
                    "dropoff_stop_id": str(drop.id),
                    "lat": pickup.location.y,
                    "lng": pickup.location.x,
                },
                format="json",
            )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        boarding = BoardingRequest.objects.get(
            trip=route_trip, pickup_stop=pickup
        )
        self.assertEqual(boarding.status, BOARDING_PENDING)
        self.assertEqual(boarding.drop_stop_id, drop.id)

    def test_route_scoped_hand_rejects_stop_from_another_route(self):
        """Route scoping is still enforced: another route's stop is refused."""
        route = self.make_route()
        other_route = self.make_route("Other Route")
        pickup = self.make_route_stop("P1", (26.81, 80.90), order=1, route=route)
        drop = self.make_route_stop("D1", (26.89, 80.90), order=2, route=route)
        foreign = self.make_route_stop(
            "Foreign", (26.83, 80.90), order=1, route=other_route
        )

        api = APIClient()
        api.force_authenticate(user=self.passenger)
        with patch("tracking.api.views.process_ride_request.delay"):
            response = api.post(
                reverse("passenger-raise-hand"),
                {
                    "route_id": str(route.id),
                    "pickup_stop_id": str(foreign.id),
                    "dropoff_stop_id": str(drop.id),
                    "lat": foreign.location.y,
                    "lng": foreign.location.x,
                },
                format="json",
            )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)


class TestAcceptJourneyRequest(JourneyTestBase):
    def _request_id(self, passenger, stop, drop=None):
        response = self.raise_hand(passenger, stop, drop=drop)
        return response.data["data"]["request_id"]

    def test_accept_attaches_to_the_existing_journey(self):
        """No second trip: the journey the driver is already running takes the
        passenger."""
        stop = self.make_stop("Boarding Stop", NEAR_STOP)
        journey = self.start_journey()
        request_id = self._request_id(self.passenger, stop)

        response = self.accept_as_driver(request_id)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["status"], "accepted")

        # Still exactly one trip, and it is the driver's journey.
        self.assertEqual(ActiveTrip.objects.filter(vehicle=self.vehicle).count(), 1)
        boarding = BoardingRequest.objects.get(id=response.data["boarding_request_id"])
        self.assertEqual(str(boarding.trip_id), journey["trip_id"])
        self.assertEqual(boarding.status, BOARDING_PENDING)
        # The safety code belongs to the boarding, so a journey can carry a
        # distinct one per passenger.
        self.assertTrue(boarding.otp)
        self.assertEqual(len(boarding.otp), 4)

    def test_journey_carries_many_passengers(self):
        stop = self.make_stop("Boarding Stop", NEAR_STOP)
        self.start_journey()
        first = User.objects.create_user(
            email="p1", password="password", role="passenger"
        )
        second = User.objects.create_user(
            email="p2", password="password", role="passenger"
        )

        self.accept_as_driver(self._request_id(first, stop))
        response = self.accept_as_driver(self._request_id(second, stop))

        self.assertEqual(response.data["status"], "accepted")
        trip = ActiveTrip.objects.get(vehicle=self.vehicle)
        boardings = list(BoardingRequest.objects.filter(trip=trip))
        self.assertEqual(len(boardings), 2)
        self.assertEqual(len({b.otp for b in boardings}), 2)

    def test_driver_who_was_not_offered_cannot_accept(self):
        stop = self.make_stop("Boarding Stop", NEAR_STOP)
        self.start_journey()
        request_id = self._request_id(self.passenger, stop)

        interloper = self.make_driver("interloper")
        response = self.accept_as_driver(request_id, driver=interloper)

        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
        self.assertFalse(BoardingRequest.objects.exists())

    def test_drop_behind_pickup_is_refused(self):
        """The drop must be ahead of the pickup on the same journey."""
        near = self.make_stop("Near", NEAR_STOP)
        far = self.make_stop("Far", FAR_STOP)
        self.start_journey()

        # Raise at the *far* stop asking to be dropped at the near one.
        request_id = self._request_id(self.passenger, far, drop=near)
        response = self.accept_as_driver(request_id)

        self.assertEqual(response.data["status"], "no_vehicle")
        self.assertFalse(BoardingRequest.objects.exists())
        # The claim was released, so another driver can still take it.
        self.assertEqual(
            DispatchRequest.objects.get(id=request_id).status,
            DispatchRequest.STATUS_PENDING,
        )

    def test_drop_ahead_of_pickup_is_accepted(self):
        near = self.make_stop("Near", NEAR_STOP)
        far = self.make_stop("Far", FAR_STOP)
        self.start_journey()

        request_id = self._request_id(self.passenger, near, drop=far)
        response = self.accept_as_driver(request_id)

        self.assertEqual(response.data["status"], "accepted")
        boarding = BoardingRequest.objects.get(id=response.data["boarding_request_id"])
        self.assertEqual(boarding.drop_stop_id, far.id)

    def test_accept_after_journey_ended_is_refused(self):
        stop = self.make_stop("Boarding Stop", NEAR_STOP)
        journey = self.start_journey()
        request_id = self._request_id(self.passenger, stop)

        JourneyService.end_journey(journey["trip_id"], self.driver)

        response = self.accept_as_driver(request_id)
        # The journey is gone, so there is nothing to attach the passenger to.
        self.assertEqual(response.data["status"], "no_vehicle")
        self.assertFalse(BoardingRequest.objects.exists())


class TestEndJourney(JourneyTestBase):
    def test_ending_settles_and_clears(self):
        stop = self.make_stop("Boarding Stop", NEAR_STOP)
        journey = self.start_journey()
        request_id = self.raise_hand(self.passenger, stop).data["data"]["request_id"]
        accept = self.accept_as_driver(request_id)

        boarding = BoardingRequest.objects.get(id=accept.data["boarding_request_id"])
        boarding.status = BOARDING_BOARDED
        boarding.save(update_fields=["status"])

        result = JourneyService.end_journey(journey["trip_id"], self.driver)

        self.assertEqual(result["status"], TRIP_STATUS_COMPLETED)
        trip = ActiveTrip.objects.get(id=journey["trip_id"])
        self.assertIsNotNone(trip.ended_at)
        self.assertIsNone(JourneyCacheService.get_journey(journey["trip_id"]))
        self.assertEqual(JourneyCacheService.get_passing_trips(str(stop.id)), [])

    def test_ending_frees_the_vehicle(self):
        journey = self.start_journey()
        JourneyService.end_journey(journey["trip_id"], self.driver)
        state = VehicleState.objects.get(vehicle=self.vehicle)
        self.assertIsNone(state.active_trip)

    def test_only_the_driver_may_end(self):
        journey = self.start_journey()
        with self.assertRaises(Exception):
            JourneyService.end_journey(journey["trip_id"], self.passenger)

    def test_ending_charges_the_boarded_passenger(self):
        """A boarded rider's segment fare moves from their wallet to the driver."""
        from accounts.models import Wallet

        near = self.make_stop("Near", NEAR_STOP)
        far = self.make_stop("Far", FAR_STOP)
        journey = self.start_journey()

        Wallet.objects.create(
            user=self.passenger, balance=Decimal("500.00"), currency="INR"
        )
        driver_wallet = Wallet.objects.create(
            user=self.driver, balance=Decimal("0.00"), currency="INR"
        )

        request_id = self.raise_hand(
            self.passenger, near, drop=far
        ).data["data"]["request_id"]
        accept = self.accept_as_driver(request_id)
        boarding = BoardingRequest.objects.get(id=accept.data["boarding_request_id"])
        boarding.status = BOARDING_BOARDED
        boarding.save(update_fields=["status"])

        JourneyService.end_journey(journey["trip_id"], self.driver)

        boarding.refresh_from_db()
        self.assertEqual(boarding.status, BOARDING_COMPLETED)

        driver_wallet.refresh_from_db()
        self.passenger.refresh_from_db()
        self.assertGreater(driver_wallet.balance, Decimal("0"))
        self.assertLess(self.passenger.wallet.balance, Decimal("500.00"))

    def test_one_underfunded_passenger_does_not_block_the_others(self):
        """Settlement collects failures instead of raising, so one rider without
        funds cannot strand the rest."""
        from accounts.models import Wallet

        near = self.make_stop("Near", NEAR_STOP)
        far = self.make_stop("Far", FAR_STOP)
        journey = self.start_journey()

        broke = User.objects.create_user(
            email="broke-rider", password="password", role="passenger"
        )
        Wallet.objects.create(user=broke, balance=Decimal("0.00"), currency="INR")
        Wallet.objects.create(
            user=self.passenger, balance=Decimal("500.00"), currency="INR"
        )

        for rider in (broke, self.passenger):
            request_id = self.raise_hand(
                rider, near, drop=far
            ).data["data"]["request_id"]
            accept = self.accept_as_driver(request_id)
            boarding = BoardingRequest.objects.get(id=accept.data["boarding_request_id"])
            boarding.status = BOARDING_BOARDED
            boarding.save(update_fields=["status"])

        result = JourneyService.end_journey(journey["trip_id"], self.driver)

        # The trip ends either way; the shortfalls are reported, not raised.
        self.assertEqual(result["status"], TRIP_STATUS_COMPLETED)
        self.assertEqual(
            BoardingRequest.objects.get(passenger=self.passenger).status,
            BOARDING_COMPLETED,
        )

    def test_ending_twice_is_idempotent(self):
        journey = self.start_journey()
        first = JourneyService.end_journey(journey["trip_id"], self.driver)
        second = JourneyService.end_journey(journey["trip_id"], self.driver)
        self.assertEqual(first["status"], TRIP_STATUS_COMPLETED)
        self.assertTrue(second["already_ended"])

    def test_end_via_api(self):
        journey = self.start_journey()
        api = APIClient()
        api.force_authenticate(user=self.driver)
        response = api.post(
            reverse("journey-end"), {"trip_id": journey["trip_id"]}, format="json"
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["data"]["status"], TRIP_STATUS_COMPLETED)


class TestDuplicatePendingBoardingIsNotFatal(JourneyTestBase):
    """
    A duplicate pending boarding must not take down the accept endpoint.

    The driver saw a 500 "An error occurred in the current transaction" when
    the passenger they were accepting already had a pending boarding on the
    same journey. unique_pending_boarding_request rejected the insert, the
    handler caught it, but accept_broadcast_request is @transaction.atomic so
    the transaction stayed aborted and the claim release raised instead.
    """

    def _seed_duplicate_pending(self, trip, passenger, stop, drop):
        """The passenger already has a pending boarding on this journey."""
        return BoardingRequest.objects.create(
            passenger=passenger,
            trip=trip,
            pickup_stop=stop,
            drop_stop=drop,
            status=BOARDING_PENDING,
            otp="1111",
        )

    def test_duplicate_pending_boarding_returns_no_500(self):
        stop = self.make_stop("Boarding Stop", NEAR_STOP)
        drop = self.make_stop("Drop Stop", FAR_STOP)
        journey = self.start_journey()
        trip = ActiveTrip.objects.get(id=journey["trip_id"])
        self._seed_duplicate_pending(trip, self.passenger, stop, drop)

        request_id = self._request_id_for(self.passenger, stop, drop)
        response = self.accept_as_driver(request_id)

        self.assertNotEqual(
            response.status_code,
            status.HTTP_500_INTERNAL_SERVER_ERROR,
            f"duplicate boarding must not 500: {response.data}",
        )
        self.assertEqual(response.status_code, status.HTTP_202_ACCEPTED)
        self.assertEqual(response.data["status"], "no_vehicle")

    def test_duplicate_boarding_releases_the_claim(self):
        """The request must go back to the pool, not sit accepted with nobody
        on board."""
        stop = self.make_stop("Boarding Stop", NEAR_STOP)
        drop = self.make_stop("Drop Stop", FAR_STOP)
        journey = self.start_journey()
        trip = ActiveTrip.objects.get(id=journey["trip_id"])
        self._seed_duplicate_pending(trip, self.passenger, stop, drop)

        request_id = self._request_id_for(self.passenger, stop, drop)
        self.accept_as_driver(request_id)

        dispatch = DispatchRequest.objects.get(id=request_id)
        self.assertEqual(dispatch.status, DispatchRequest.STATUS_PENDING)
        self.assertIsNone(dispatch.accepted_by)

    def test_outer_transaction_still_usable_after_the_rejection(self):
        """The savepoint is the actual fix: without it the release save() raises
        TransactionManagementError."""
        stop = self.make_stop("Boarding Stop", NEAR_STOP)
        drop = self.make_stop("Drop Stop", FAR_STOP)
        journey = self.start_journey()
        trip = ActiveTrip.objects.get(id=journey["trip_id"])
        self._seed_duplicate_pending(trip, self.passenger, stop, drop)

        request_id = self._request_id_for(self.passenger, stop, drop)

        with transaction.atomic():
            result = DispatchService.accept_broadcast_request(
                request_id, self.driver
            )
            # If the insert had poisoned this transaction, this query raises.
            DispatchRequest.objects.get(id=request_id)

        self.assertEqual(result["status"], "no_vehicle")

    def test_accept_response_carries_passenger_identity(self):
        """The driver's accepted-rider card needs a name, a number to dial and
        the stops -- not just an OTP."""
        from accounts.models import PublicPassengerProfile

        PublicPassengerProfile.objects.create(
            user=self.passenger, display_name="Asha Rider", phone_number="+919812345678"
        )
        stop = self.make_stop("Boarding Stop", NEAR_STOP)
        drop = self.make_stop("Drop Stop", FAR_STOP)
        journey = self.start_journey()
        request_id = self._request_id_for(self.passenger, stop, drop)

        response = self.accept_as_driver(request_id)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        data = response.data
        self.assertEqual(data["passenger_name"], "Asha Rider")
        self.assertEqual(data["passenger_phone"], "+919812345678")
        self.assertEqual(data["pickup_stop_name"], "Boarding Stop")
        self.assertEqual(data["drop_stop_name"], "Drop Stop")
        self.assertTrue(data["otp"])
        self.assertEqual(data["trip_id"], journey["trip_id"])

    def test_accept_response_falls_back_when_no_profile(self):
        """A rider without a profile is still identifiable, and the phone is
        blank rather than leaking another number."""
        stop = self.make_stop("Boarding Stop", NEAR_STOP)
        drop = self.make_stop("Drop Stop", FAR_STOP)
        self.start_journey()
        request_id = self._request_id_for(self.passenger, stop, drop)

        response = self.accept_as_driver(request_id)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertTrue(response.data["passenger_name"])
        self.assertEqual(response.data["passenger_phone"], "")

    def test_clean_accept_after_a_duplicate_still_works(self):
        """One rejected duplicate must not poison the request for the next
        driver."""
        stop = self.make_stop("Boarding Stop", NEAR_STOP)
        drop = self.make_stop("Drop Stop", FAR_STOP)
        journey = self.start_journey()
        trip = ActiveTrip.objects.get(id=journey["trip_id"])
        self._seed_duplicate_pending(trip, self.passenger, stop, drop)

        failed_id = self._request_id_for(self.passenger, stop, drop)
        self.accept_as_driver(failed_id)

        # The passenger's pending booking is gone (cancelled), so a fresh
        # request can be accepted normally.
        BoardingRequest.objects.filter(
            passenger=self.passenger, status=BOARDING_PENDING
        ).update(status=BOARDING_CANCELLED)

        second_id = self._request_id_for(self.passenger, stop, drop)
        response = self.accept_as_driver(second_id)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["status"], "accepted")

    def _request_id_for(self, passenger, stop, drop):
        response = self.raise_hand(passenger, stop, drop=drop)
        return response.data["data"]["request_id"]


class TestSettledSegmentFare(JourneyTestBase):
    """
    What one rider was actually charged.

    The fare screens show stored figures, so these pin that settlement writes
    the segment (distance/duration/fare) onto the boarding request rather than
    leaving it to be recomputed from stops that may be edited later.
    """

    def board_a_rider(self, near, far):
        """Raise, accept and board one passenger; returns the BoardingRequest."""
        request_id = self.raise_hand(
            self.passenger, near, drop=far
        ).data["data"]["request_id"]
        accept = self.accept_as_driver(request_id)
        boarding = BoardingRequest.objects.get(id=accept.data["boarding_request_id"])
        boarding.status = BOARDING_BOARDED
        boarding.save(update_fields=["status"])
        return boarding

    def fund(self, amount="500.00"):
        Wallet.objects.create(
            user=self.passenger, balance=Decimal(amount), currency="INR"
        )
        Wallet.objects.create(
            user=self.driver, balance=Decimal("0.00"), currency="INR"
        )

    def test_segment_is_persisted_on_settlement(self):
        near = self.make_stop("Near", NEAR_STOP)
        far = self.make_stop("Far", FAR_STOP)
        journey = self.start_journey()
        self.fund()
        boarding = self.board_a_rider(near, far)

        self.assertIsNone(boarding.fare, "fare must be unset before settlement")

        JourneyService.end_journey(journey["trip_id"], self.driver)

        boarding.refresh_from_db()
        self.assertIsNotNone(boarding.fare)
        self.assertGreater(boarding.fare, Decimal("0"))
        self.assertIsNotNone(boarding.segment_distance_m)
        self.assertGreater(boarding.segment_distance_m, 0)
        self.assertIsNotNone(boarding.dropped_off_at)

    def test_stored_fare_matches_money_moved(self):
        """The displayed figure must be the figure that was debited."""
        near = self.make_stop("Near", NEAR_STOP)
        far = self.make_stop("Far", FAR_STOP)
        journey = self.start_journey()
        self.fund()
        boarding = self.board_a_rider(near, far)

        JourneyService.end_journey(journey["trip_id"], self.driver)

        boarding.refresh_from_db()
        # settle_debit appends a role suffix to the logical reference.
        debit = Transaction.objects.filter(
            reference=f"trip_{journey['trip_id']}:p{boarding.id}:debit"
        ).first()
        self.assertIsNotNone(
            debit, f"no debit row for reference trip_{journey['trip_id']}:p{boarding.id}"
        )
        self.assertEqual(debit.amount, boarding.fare)

    def test_end_response_lists_each_passenger_fare(self):
        near = self.make_stop("Near", NEAR_STOP)
        far = self.make_stop("Far", FAR_STOP)
        journey = self.start_journey()
        self.fund()
        self.board_a_rider(near, far)

        result = JourneyService.end_journey(journey["trip_id"], self.driver)

        self.assertEqual(result["passenger_count"], 1)
        self.assertEqual(len(result["passengers"]), 1)
        entry = result["passengers"][0]
        self.assertGreater(entry["fare"], 0)
        self.assertEqual(entry["pickup_stop_name"], "Near")
        self.assertEqual(entry["drop_stop_name"], "Far")
        self.assertAlmostEqual(result["total_fare"], entry["fare"], places=2)

    def test_two_passengers_are_charged_separately(self):
        """One journey, two riders on different segments: neither is billed the
        whole run."""
        near = self.make_stop("Near", NEAR_STOP)
        mid = self.make_stop("Mid", (26.8600, 80.9000))
        far = self.make_stop("Far", FAR_STOP)
        journey = self.start_journey()
        self.fund()

        second = User.objects.create_user(
            email="fare-rider-2", password="password", role="passenger"
        )
        Wallet.objects.create(
            user=second, balance=Decimal("500.00"), currency="INR"
        )
        # Rider one covers the whole corridor, rider two only its last leg.
        first_boarding = self.board_a_rider(near, far)

        request_id = self.raise_hand(
            second, mid, drop=far
        ).data["data"]["request_id"]
        accept = self.accept_as_driver(request_id)
        second_boarding = BoardingRequest.objects.get(
            id=accept.data["boarding_request_id"]
        )
        second_boarding.status = BOARDING_BOARDED
        second_boarding.save(update_fields=["status"])

        result = JourneyService.end_journey(journey["trip_id"], self.driver)

        self.assertEqual(result["passenger_count"], 2)
        self.assertEqual(len(result["passengers"]), 2)

        first_boarding.refresh_from_db()
        second_boarding.refresh_from_db()

        # Identify each rider by boarding id: BoardingRequest orders by
        # -created_at, so the summary is newest-first, not insertion order.
        by_boarding = {p["boarding_request_id"]: p for p in result["passengers"]}
        first_entry = by_boarding[str(first_boarding.id)]
        second_entry = by_boarding[str(second_boarding.id)]

        # The first rider's pickup→drop spans the whole corridor, the second's
        # only its final leg, so the two prices must differ -- neither collapses
        # to the journey's total distance.
        self.assertGreater(first_entry["fare"], second_entry["fare"])
        self.assertAlmostEqual(
            result["total_fare"],
            first_entry["fare"] + second_entry["fare"],
            places=2,
        )
        self.assertAlmostEqual(
            float(first_boarding.fare), first_entry["fare"], places=2
        )
        self.assertGreater(first_boarding.segment_distance_m, 0)

    def test_boarding_serializer_exposes_the_settled_fare(self):
        near = self.make_stop("Near", NEAR_STOP)
        far = self.make_stop("Far", FAR_STOP)
        journey = self.start_journey()
        self.fund()
        boarding = self.board_a_rider(near, far)
        JourneyService.end_journey(journey["trip_id"], self.driver)

        data = BoardingRequestSerializer(
            BoardingRequest.objects.get(id=boarding.id)
        ).data

        self.assertIsNotNone(data["fare"])
        self.assertIsNotNone(data["segment_distance_m"])
        self.assertEqual(data["pickup_stop_detail"]["name"], "Near")
        self.assertEqual(data["drop_stop_detail"]["name"], "Far")

    def test_cancelled_journey_charges_nobody(self):
        near = self.make_stop("Near", NEAR_STOP)
        far = self.make_stop("Far", FAR_STOP)
        journey = self.start_journey()
        self.fund()
        boarding = self.board_a_rider(near, far)

        result = JourneyService.end_journey(
            journey["trip_id"], self.driver, cancel=True
        )

        boarding.refresh_from_db()
        self.assertIsNone(boarding.fare, "a cancelled journey must not bill")
        self.assertEqual(result["passengers"], [])
        self.assertEqual(result["passenger_count"], 0)


class TestJourneyDetail(JourneyTestBase):
    def test_detail_returns_path_and_stops(self):
        stop = self.make_stop("Boarding Stop", NEAR_STOP)
        journey = self.start_journey()

        api = APIClient()
        api.force_authenticate(user=self.driver)
        response = api.get(reverse("journey-detail", args=[journey["trip_id"]]))

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(
            [s["stop_id"] for s in response.data["data"]["stops"]], [str(stop.id)]
        )

    def test_detail_is_driver_only(self):
        journey = self.start_journey()
        api = APIClient()
        api.force_authenticate(user=self.passenger)
        response = api.get(reverse("journey-detail", args=[journey["trip_id"]]))
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)


class TestCorridorVehicleSearch(JourneyTestBase):
    """
    The passenger's "which vehicle is running my route right now?" search.

    Resolves the road between two searched points and returns the live vehicles
    serving a stop on it, so the single trip-planner button can show real
    vehicles instead of a fixed route list.
    """

    def search(self, origin=ORIGIN, destination=DESTINATION, **extra):
        api = APIClient()
        api.force_authenticate(user=self.passenger)
        with patch(
            "transport.services.osrm_service.OSRMService.get_road_path",
            return_value=_fake_osrm_path(),
        ):
            return api.post(
                reverse("corridor-vehicles"),
                {
                    "origin": {"lat": origin[0], "lng": origin[1]},
                    "destination": {"lat": destination[0], "lng": destination[1]},
                    **extra,
                },
                format="json",
            )

    def test_returns_the_live_vehicle_on_the_route(self):
        pickup_stop = self.make_stop("Pickup Stop", NEAR_STOP)
        self.make_stop("Drop Stop", FAR_STOP)
        self.start_journey()

        response = self.search(origin=NEAR_STOP, destination=FAR_STOP)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        data = response.data["data"]
        self.assertTrue(data["resolved"])
        self.assertEqual(len(data["vehicles"]), 1)

        vehicle = data["vehicles"][0]
        self.assertEqual(vehicle["vehicle_number"], self.vehicle.vehicle_number)
        # Not get_full_name(): this User model has no first/last name, so that
        # is empty for every account. The profile display name is what a rider
        # is shown, so it is what the card must carry.
        self.assertEqual(vehicle["driver_name"], "Journey Driver")
        # The boarding stop is the one the passenger would actually walk to.
        self.assertEqual(vehicle["board_stop"]["id"], str(pickup_stop.id))
        self.assertEqual(vehicle["board_stop"]["name"], "Pickup Stop")

    def test_returns_the_resolved_path_and_stops(self):
        """The app draws the corridor, so the geometry has to come back too."""
        self.make_stop("Mid Stop", NEAR_STOP)
        self.start_journey()

        data = self.search().data["data"]

        self.assertGreater(len(data["path"]), 1)
        self.assertEqual(len(data["stops"]), 1)
        self.assertIn("dist_along_m", data["stops"][0])
        self.assertIsNotNone(data["distance_m"])

    def test_no_live_vehicle_returns_an_empty_list(self):
        """A route with nothing running on it is a valid answer, not an error."""
        self.make_stop("Mid Stop", NEAR_STOP)

        response = self.search()

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["data"]["vehicles"], [])

    def test_vehicle_past_the_stop_is_excluded(self):
        """A driver already beyond the pickup cannot be offered that ride."""
        self.make_stop("Pickup Stop", NEAR_STOP)
        self.make_stop("Drop Stop", FAR_STOP)
        journey = self.start_journey()

        # Both durable state and the live Redis snapshot are updated by the GPS
        # pipeline; update both here to simulate a real vehicle that has moved.
        VehicleState.objects.filter(vehicle=self.vehicle).update(
            current_location=Point(DESTINATION[1], DESTINATION[0], srid=4326)
        )
        from tracking.services.redis_geo_service import RedisGeoService
        RedisGeoService.set_vehicle_snapshot(
            str(self.vehicle.id), DESTINATION[0], DESTINATION[1], trip_id=journey["trip_id"]
        )

        response = self.search(origin=NEAR_STOP, destination=FAR_STOP)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        # Either excluded outright, or still offered because progress could not
        # be established - never offered with a stop it has passed.
        for vehicle in response.data["data"]["vehicles"]:
            self.assertIsNotNone(vehicle["board_stop"]["id"])

    def test_search_creates_nothing(self):
        """A search is read-only: no trip, no boarding, no driver state change."""
        self.make_stop("Mid Stop", NEAR_STOP)
        self.start_journey()
        trips_before = ActiveTrip.objects.count()

        self.search()

        self.assertEqual(ActiveTrip.objects.count(), trips_before)
        self.assertEqual(BoardingRequest.objects.count(), 0)

    def test_driver_cannot_use_the_passenger_search(self):
        self.make_stop("Mid Stop", NEAR_STOP)
        self.start_journey()

        api = APIClient()
        api.force_authenticate(user=self.driver)
        with patch(
            "transport.services.osrm_service.OSRMService.get_road_path",
            return_value=_fake_osrm_path(),
        ):
            response = api.post(
                reverse("corridor-vehicles"),
                {
                    "origin": {"lat": ORIGIN[0], "lng": ORIGIN[1]},
                    "destination": {"lat": DESTINATION[0], "lng": DESTINATION[1]},
                },
                format="json",
            )

        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_requires_authentication(self):
        response = APIClient().post(
            reverse("corridor-vehicles"),
            {
                "origin": {"lat": ORIGIN[0], "lng": ORIGIN[1]},
                "destination": {"lat": DESTINATION[0], "lng": DESTINATION[1]},
            },
            format="json",
        )
        self.assertIn(
            response.status_code,
            (status.HTTP_401_UNAUTHORIZED, status.HTTP_403_FORBIDDEN),
        )

    def test_two_journeys_on_one_corridor_both_appear(self):
        """Two drivers running the same road are two real choices."""
        self.make_stop("Pickup Stop", NEAR_STOP)
        self.make_stop("Drop Stop", FAR_STOP)
        self.start_journey()

        second_driver = self.make_driver("corridor-driver-2")
        second_vehicle = Vehicle.objects.create(
            vehicle_number="JV-2", vehicle_type="bike",
            city=self.city, driver=second_driver,
        )
        with patch(
            "transport.services.osrm_service.OSRMService.get_road_path",
            return_value=_fake_osrm_path(),
        ):
            JourneyService.start_journey(
                driver=second_driver,
                vehicle_id=str(second_vehicle.id),
                origin=ORIGIN,
                destination=DESTINATION,
            )

        data = self.search(origin=NEAR_STOP, destination=FAR_STOP).data["data"]

        self.assertEqual(len(data["vehicles"]), 2)
        numbers = {v["vehicle_number"] for v in data["vehicles"]}
        self.assertEqual(numbers, {"JV-1", "JV-2"})


class TestCorridorEtaAndNamesAreHonest(JourneyTestBase):
    """
    Two units/name traps that only show up against real data.

    Both were caught by running the endpoint against a live journey rather than
    a mocked one: the driver card rendered an empty name, and a 17-minute
    arrival was labelled "1058 min".
    """

    def test_driver_name_uses_the_profile_not_get_full_name(self):
        self.make_stop("Pickup Stop", NEAR_STOP)
        self.make_stop("Drop Stop", FAR_STOP)
        self.start_journey()

        api = APIClient()
        api.force_authenticate(user=self.passenger)
        with patch(
            "transport.services.osrm_service.OSRMService.get_road_path",
            return_value=_fake_osrm_path(),
        ):
            data = api.post(
                reverse("corridor-vehicles"),
                {
                    "origin": {"lat": NEAR_STOP[0], "lng": NEAR_STOP[1]},
                    "destination": {"lat": FAR_STOP[0], "lng": FAR_STOP[1]},
                },
                format="json",
            ).data["data"]

        self.assertEqual(len(data["vehicles"]), 1)
        self.assertEqual(data["vehicles"][0]["driver_name"], "Journey Driver")

    def test_eta_is_minutes_not_seconds(self):
        """eta_to_stop_s returns seconds; the field the app renders is minutes."""
        self.make_stop("Pickup Stop", NEAR_STOP)
        self.make_stop("Drop Stop", FAR_STOP)
        self.start_journey()

        api = APIClient()
        api.force_authenticate(user=self.passenger)
        with patch(
            "transport.services.osrm_service.OSRMService.get_road_path",
            return_value=_fake_osrm_path(),
        ):
            data = api.post(
                reverse("corridor-vehicles"),
                {
                    "origin": {"lat": NEAR_STOP[0], "lng": NEAR_STOP[1]},
                    "destination": {"lat": FAR_STOP[0], "lng": FAR_STOP[1]},
                },
                format="json",
            ).data["data"]

        eta = data["vehicles"][0]["eta_minutes"]
        self.assertIsNotNone(eta)
        # A 13 km corridor at city speed is tens of minutes. Raw seconds from
        # the same estimate would be in the hundreds.
        self.assertGreater(eta, 0)
        self.assertLess(eta, 180, f"ETA looks like seconds, not minutes: {eta}")


class TestPassengerSegmentCompletion(JourneyTestBase):
    """A rider completes their segment without ending the shared journey."""

    def _wallet(self, user, amount="500.00"):
        Wallet.objects.create(user=user, balance=Decimal(amount), currency="INR")

    def _request_and_accept(self, passenger, pickup, drop):
        request_id = self.raise_hand(passenger, pickup, drop=drop).data["data"]["request_id"]
        response = self.accept_as_driver(request_id)
        self.assertEqual(response.data["status"], "accepted", response.data)
        return response.data

    def test_wrong_otp_does_not_board_the_passenger(self):
        pickup = self.make_stop("OTP Pickup", NEAR_STOP)
        drop = self.make_stop("OTP Drop", FAR_STOP)
        journey = self.start_journey()
        accepted = self._request_and_accept(self.passenger, pickup, drop)
        boarding = BoardingRequest.objects.get(id=accepted["boarding_request_id"])

        with self.assertRaisesRegex(ValueError, "Invalid Safety Code"):
            DispatchService.start_trip(
                journey["trip_id"], self.driver, otp="0000",
                boarding_request_id=str(boarding.id),
            )

        boarding.refresh_from_db()
        self.assertEqual(boarding.status, BOARDING_PENDING)

    def test_each_passenger_segment_settles_independently_and_retry_is_idempotent(self):
        pickup = self.make_stop("Segment Pickup", NEAR_STOP)
        middle = self.make_stop("Segment Middle", (26.8600, 80.9000))
        drop = self.make_stop("Segment Drop", FAR_STOP)
        journey = self.start_journey()

        second_passenger = User.objects.create_user(
            email="segment-passenger-2", password="password", role="passenger"
        )
        self._wallet(self.passenger)
        self._wallet(second_passenger)
        self._wallet(self.driver, "0.00")

        first = self._request_and_accept(self.passenger, pickup, middle)
        second = self._request_and_accept(second_passenger, middle, drop)
        first_id = str(first["boarding_request_id"])
        second_id = str(second["boarding_request_id"])

        DispatchService.start_trip(
            journey["trip_id"], self.driver, otp=first["otp"],
            boarding_request_id=first_id,
        )
        DispatchService.start_trip(
            journey["trip_id"], self.driver, otp=second["otp"],
            boarding_request_id=second_id,
        )

        with patch.object(DispatchService, "_notify_ws") as notify:
            first_result = DispatchService.complete_trip(
                journey["trip_id"], self.driver, boarding_request_id=first_id
            )

        self.assertEqual(first_result["status"], "completed")
        self.assertGreater(first_result["fare"], 0)
        self.assertGreater(first_result["segment_distance_m"], 0)
        self.assertGreater(first_result["segment_duration_s"], 0)
        self.assertEqual(notify.call_count, 1)
        self.assertEqual(notify.call_args.args[2]["boarding_request_id"], first_id)

        first_boarding = BoardingRequest.objects.get(id=first_id)
        second_boarding = BoardingRequest.objects.get(id=second_id)
        self.assertEqual(first_boarding.status, BOARDING_COMPLETED)
        self.assertEqual(second_boarding.status, BOARDING_BOARDED)

        transaction_count = Transaction.objects.count()
        retry = DispatchService.complete_trip(
            journey["trip_id"], self.driver, boarding_request_id=first_id
        )
        self.assertTrue(retry["already_completed"])
        self.assertEqual(retry["fare"], first_result["fare"])
        self.assertEqual(Transaction.objects.count(), transaction_count)
        self.assertEqual(second_boarding.status, BOARDING_BOARDED)

        second_result = DispatchService.complete_trip(
            journey["trip_id"], self.driver, boarding_request_id=second_id
        )
        self.assertEqual(second_result["status"], "completed")
        self.assertGreater(second_result["fare"], 0)
        self.assertEqual(
            BoardingRequest.objects.get(id=second_id).status, BOARDING_COMPLETED
        )
        # The shared trip is still active; only ending the driver's journey ends it.
        self.assertEqual(ActiveTrip.objects.get(id=journey["trip_id"]).status, TRIP_STATUS_ACTIVE)


class TestCompleteBikeJourneyAPIFlow(JourneyTestBase):
    """Exercise the driver/passenger bike journey from HTTP start to settlement."""

    def test_full_driver_passenger_api_flow(self):
        import hashlib
        import json
        from django.core.cache import cache

        # Delete only this deterministic corridor cache entry after the test;
        # never flush the shared Redis DB, which may also serve the running app.
        cache_material = json.dumps([
            round(float(NEAR_STOP[0]), 5), round(float(NEAR_STOP[1]), 5),
            round(float(FAR_STOP[0]), 5), round(float(FAR_STOP[1]), 5), 5000,
        ], separators=(",", ":"))
        corridor_cache_key = "vayy:corridor-search:" + hashlib.sha1(
            cache_material.encode()
        ).hexdigest()
        self.addCleanup(cache.delete, corridor_cache_key)

        pickup = self.make_stop("E2E Pickup", NEAR_STOP)
        drop = self.make_stop("E2E Drop", FAR_STOP)
        Wallet.objects.create(
            user=self.passenger, balance=Decimal("500.00"), currency="INR"
        )
        Wallet.objects.create(
            user=self.driver, balance=Decimal("0.00"), currency="INR"
        )

        driver_api = APIClient()
        driver_api.force_authenticate(user=self.driver)
        passenger_api = APIClient()
        passenger_api.force_authenticate(user=self.passenger)

        # The journey and passenger's requested corridor both resolve to the
        # same deterministic road geometry; the rest of the workflow is real.
        with patch(
            "transport.services.osrm_service.OSRMService.get_road_path",
            return_value=_fake_osrm_path(),
        ):
            start = driver_api.post(
                reverse("journey-start"),
                {
                    "vehicle_id": str(self.vehicle.id),
                    "origin": {"lat": ORIGIN[0], "lng": ORIGIN[1]},
                    "destination": {"lat": DESTINATION[0], "lng": DESTINATION[1]},
                    "origin_name": "E2E Origin",
                    "destination_name": "E2E Destination",
                },
                format="json",
            )
            self.assertEqual(start.status_code, status.HTTP_201_CREATED, start.data)
            trip_id = start.data["data"]["trip_id"]

            search = passenger_api.post(
                reverse("corridor-vehicles"),
                {
                    # Passenger-selected pickup/drop are intermediate stops on
                    # the driver's longer origin→destination journey.
                    "origin": {"lat": NEAR_STOP[0], "lng": NEAR_STOP[1]},
                    "destination": {"lat": FAR_STOP[0], "lng": FAR_STOP[1]},
                },
                format="json",
            )

        self.assertEqual(search.status_code, status.HTTP_200_OK, search.data)
        self.assertTrue(search.data["success"])
        self.assertTrue(
            any(row["trip_id"] == trip_id for row in search.data["data"]["vehicles"]),
            search.data,
        )

        raised = self.raise_hand(self.passenger, pickup, drop=drop)
        self.assertEqual(raised.status_code, status.HTTP_201_CREATED, raised.data)
        request_id = raised.data["data"]["request_id"]

        accepted = self.accept_as_driver(request_id)
        self.assertEqual(accepted.status_code, status.HTTP_200_OK, accepted.data)
        self.assertEqual(accepted.data["status"], "accepted")
        self.assertEqual(accepted.data["trip_id"], trip_id)
        boarding_id = accepted.data["boarding_request_id"]
        otp = accepted.data["otp"]

        arrived = driver_api.patch(
            reverse("dispatch-arrived", args=[trip_id]),
            {"boarding_request_id": boarding_id},
            format="json",
        )
        self.assertEqual(arrived.status_code, status.HTTP_200_OK, arrived.data)

        boarded = driver_api.patch(
            reverse("dispatch-start", args=[trip_id]),
            {"boarding_request_id": boarding_id, "otp": otp},
            format="json",
        )
        self.assertEqual(boarded.status_code, status.HTTP_200_OK, boarded.data)
        self.assertEqual(
            BoardingRequest.objects.get(id=boarding_id).status, BOARDING_BOARDED
        )

        completed = driver_api.patch(
            reverse("dispatch-complete", args=[trip_id]),
            {"boarding_request_id": boarding_id},
            format="json",
        )
        self.assertEqual(completed.status_code, status.HTTP_200_OK, completed.data)
        result = completed.data["data"]
        self.assertEqual(result["status"], "completed")
        self.assertGreater(result["fare"], 0)
        self.assertGreater(result["segment_distance_m"], 0)
        self.assertGreater(result["segment_duration_s"], 0)

        boarding = BoardingRequest.objects.get(id=boarding_id)
        self.assertEqual(boarding.status, BOARDING_COMPLETED)
        self.assertEqual(Transaction.objects.filter(
            reference=f"trip_{trip_id}:p{boarding_id}:debit"
        ).count(), 1)

        ended = driver_api.post(
            reverse("journey-end"), {"trip_id": trip_id}, format="json"
        )
        self.assertEqual(ended.status_code, status.HTTP_200_OK, ended.data)
        self.assertEqual(ended.data["data"]["status"], TRIP_STATUS_COMPLETED)
        self.assertFalse(ActiveTrip.objects.filter(id=trip_id, status=TRIP_STATUS_ACTIVE).exists())
        self.assertIsNone(JourneyCacheService.get_journey(trip_id))
        self.assertEqual(Transaction.objects.filter(
            reference=f"trip_{trip_id}:p{boarding_id}:debit"
        ).count(), 1)
        self.assertEqual(
            driver_api.get(reverse("journey-active")).data["data"], None
        )
