import pytest
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APIClient
from accounts.models import User
from operations.models import Vehicle, ActiveTrip
from transport.models import Route, City

@pytest.mark.django_db
class TestDispatchWorkflow:
    @pytest.fixture
    def api_client(self):
        return APIClient()

    @pytest.fixture
    def test_data(self):
        city = City.objects.create(name="Test City")
        route = Route.objects.create(name="Test Route", city=city)
        driver = User.objects.create_user(username="driver", password="password", role="bikedriver")
        passenger = User.objects.create_user(username="passenger", password="password", role="passenger")
        vehicle = Vehicle.objects.create(vehicle_number="V1", vehicle_type="bike", city=city, driver=driver)
        return {
            "city": city,
            "route": route,
            "driver": driver,
            "passenger": passenger,
            "vehicle": vehicle
        }

    def test_dispatch_request_api(self, api_client, test_data):
        api_client.force_authenticate(user=test_data["passenger"])
        url = reverse("dispatch-request")
        data = {
            "route_id": str(test_data["route"].id),
            "pickup_stop_id": str(test_data["route"].id) # Mocking stop with route ID for brevity
        }
        response = api_client.post(url, data)
        assert response.status_code == status.HTTP_202_ACCEPTED
        assert response.data["status"] == "request_received"

    def test_dispatch_assign_api(self, api_client, test_data):
        # Authenticate as admin (standard authenticated user for prototype)
        api_client.force_authenticate(user=test_data["driver"]) 
        url = reverse("dispatch-assign")
        data = {
            "vehicle_id": str(test_data["vehicle"].id),
            "driver_id": str(test_data["driver"].id),
            "route_id": str(test_data["route"].id)
        }
        response = api_client.post(url, data)
        assert response.status_code == status.HTTP_201_CREATED
        assert ActiveTrip.objects.filter(driver=test_data["driver"], status="active").exists()

    def test_gps_ingest_api(self, api_client, test_data):
        api_client.force_authenticate(user=test_data["driver"])
        url = reverse("gps-ingest")
        data = {
            "vehicle_id": str(test_data["vehicle"].id),
            "lat": 12.9716,
            "lng": 77.5946,
            "speed": 40,
            "heading": 180
        }
        response = api_client.post(url, data)
        assert response.status_code == status.HTTP_201_CREATED
        assert "id" in response.data
