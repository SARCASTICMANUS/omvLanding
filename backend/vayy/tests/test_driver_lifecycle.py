import pytest
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APIClient
from accounts.models import User
from operations.models import Vehicle, ActiveTrip, VehicleState
from transport.models import Route, City, Stop
from django.contrib.gis.geos import Point
from operations.constants import (
    TRIP_STATUS_ASSIGNED, TRIP_STATUS_ACCEPTED, TRIP_STATUS_ARRIVED,
    TRIP_STATUS_ACTIVE, TRIP_STATUS_COMPLETED
)

@pytest.mark.django_db
class TestDriverLifecycle:
    @pytest.fixture
    def api_client(self):
        return APIClient()

    @pytest.fixture
    def test_data(self):
        city = City.objects.create(name="Bangalore")
        route = Route.objects.create(name="Route 1", city=city, path="LINESTRING(0 0, 1 1)")
        driver = User.objects.create_user(username="driver", password="password", role="driver")
        vehicle = Vehicle.objects.create(vehicle_number="KA-01-1234", vehicle_type="car", city=city, driver=driver)
        state = VehicleState.objects.create(vehicle=vehicle)
        trip = ActiveTrip.objects.create(vehicle=vehicle, route=route, driver=driver, status=TRIP_STATUS_ASSIGNED)
        return {
            "driver": driver,
            "trip": trip
        }

    def test_accept_assignment(self, api_client, test_data):
        api_client.force_authenticate(user=test_data["driver"])
        url = reverse("dispatch-accept", kwargs={"trip_id": test_data["trip"].id})
        response = api_client.patch(url)
        assert response.status_code == status.HTTP_200_OK
        assert response.data["data"]["status"] == TRIP_STATUS_ACCEPTED

    def test_arrived_at_pickup(self, api_client, test_data):
        test_data["trip"].status = TRIP_STATUS_ACCEPTED
        test_data["trip"].save()
        api_client.force_authenticate(user=test_data["driver"])
        url = reverse("dispatch-arrived", kwargs={"trip_id": test_data["trip"].id})
        response = api_client.patch(url)
        assert response.status_code == status.HTTP_200_OK
        assert response.data["data"]["status"] == TRIP_STATUS_ARRIVED

    def test_start_trip(self, api_client, test_data):
        test_data["trip"].status = TRIP_STATUS_ARRIVED
        test_data["trip"].save()
        api_client.force_authenticate(user=test_data["driver"])
        url = reverse("dispatch-start", kwargs={"trip_id": test_data["trip"].id})
        response = api_client.patch(url)
        assert response.status_code == status.HTTP_200_OK
        assert response.data["data"]["status"] == TRIP_STATUS_ACTIVE

    def test_complete_trip(self, api_client, test_data):
        test_data["trip"].status = TRIP_STATUS_ACTIVE
        test_data["trip"].save()
        api_client.force_authenticate(user=test_data["driver"])
        url = reverse("dispatch-complete", kwargs={"trip_id": test_data["trip"].id})
        response = api_client.patch(url)
        assert response.status_code == status.HTTP_200_OK
        assert response.data["data"]["status"] == TRIP_STATUS_COMPLETED
