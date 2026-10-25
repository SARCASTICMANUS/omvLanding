from django.contrib.gis.geos import LineString, Point
from django.test import TestCase
from rest_framework.test import APIClient

from accounts.models import User
from operations.models import ActiveTrip, Vehicle
from transport.models import City, Route, RouteStopAssociation, Stop


class AdminCityDeleteTests(TestCase):
    def setUp(self):
        admin = User.objects.create_user(
            email="city-delete-admin@example.test",
            password="test-password",
            role="admin",
        )
        self.client = APIClient()
        self.client.force_authenticate(user=admin)

    def create_city_route_and_membership(self):
        city = City.objects.create(name="Lucknow")
        route = Route.objects.create(
            city=city,
            name="Test direction",
            path=LineString([(80.9, 26.8), (80.91, 26.81)], srid=4326),
        )
        stop = Stop.objects.create(
            city=city,
            name="Test stop",
            location=Point(80.9, 26.8, srid=4326),
        )
        membership = RouteStopAssociation.objects.create(
            route=route,
            stop=stop,
            order=1,
        )
        return city, route, stop, membership

    def test_city_delete_removes_its_route_memberships_before_protected_stops(self):
        city, route, stop, membership = self.create_city_route_and_membership()

        response = self.client.delete(f"/api/transport/admin/cities/{city.slug}/")

        self.assertEqual(response.status_code, 200, response.data)
        self.assertFalse(City.objects.filter(pk=city.pk).exists())
        self.assertFalse(Route.objects.filter(pk=route.pk).exists())
        self.assertFalse(Stop.objects.filter(pk=stop.pk).exists())
        self.assertFalse(RouteStopAssociation.objects.filter(pk=membership.pk).exists())

    def test_city_delete_preserves_routes_when_trip_history_exists(self):
        city, route, _stop, membership = self.create_city_route_and_membership()
        driver = User.objects.create_user(
            email="city-delete-driver@example.test",
            password="test-password",
            role="bikedriver",
        )
        vehicle = Vehicle.objects.create(
            city=city,
            route=route,
            driver=driver,
            vehicle_number="LKO-DELETE-TEST",
            vehicle_type="bike",
        )
        trip = ActiveTrip.objects.create(
            vehicle=vehicle,
            route=route,
            driver=driver,
            status="completed",
        )

        response = self.client.delete(f"/api/transport/admin/cities/{city.slug}/")

        self.assertEqual(response.status_code, 409, response.data)
        self.assertEqual(response.data["code"], "CITY_HAS_TRIPS")
        self.assertTrue(City.objects.filter(pk=city.pk).exists())
        self.assertTrue(Route.objects.filter(pk=route.pk).exists())
        self.assertTrue(RouteStopAssociation.objects.filter(pk=membership.pk).exists())
        self.assertTrue(ActiveTrip.objects.filter(pk=trip.pk).exists())
