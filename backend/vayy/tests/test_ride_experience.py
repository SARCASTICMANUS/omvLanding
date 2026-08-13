import pytest
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APIClient
from accounts.models import User
from operations.models import Vehicle, VehicleState
from transport.models import Route, City, Stop
from django.contrib.gis.geos import Point

@pytest.mark.django_db
class TestRideExperience:
    @pytest.fixture
    def api_client(self):
        return APIClient()

    @pytest.fixture
    def test_data(self):
        city = City.objects.create(name="Bangalore", location=Point(77.5946, 12.9716, srid=4326))
        route = Route.objects.create(name="Route 1", city=city, path="LINESTRING(77.5946 12.9716, 77.6046 12.9816)")
        stop = Stop.objects.create(route=route, name="Stop 1", location=Point(77.5946, 12.9716, srid=4326), order=1)
        passenger = User.objects.create_user(username="passenger", password="password", role="passenger")
        driver = User.objects.create_user(username="driver", password="password", role="driver")
        vehicle = Vehicle.objects.create(vehicle_number="KA-01-1234", vehicle_type="bike", city=city, driver=driver)
        state = VehicleState.objects.create(vehicle=vehicle, current_location=Point(77.5956, 12.9726, srid=4326))
        return {
            "city": city,
            "route": route,
            "stop": stop,
            "passenger": passenger,
            "vehicle": vehicle,
            "state": state
        }

    def test_ride_estimate_api(self, api_client, test_data):
        api_client.force_authenticate(user=test_data["passenger"])
        url = reverse("ride-estimate")
        data = {
            "pickup_lat": 12.9716,
            "pickup_lng": 77.5946,
            "drop_lat": 12.9816,
            "drop_lng": 77.6046,
            "vehicle_type": "bike"
        }
        response = api_client.post(url, data)
        assert response.status_code == status.HTTP_200_OK
        assert response.data["success"] is True
        assert "estimated_fare" in response.data["data"]

    def test_nearby_vehicles_api(self, api_client, test_data):
        api_client.force_authenticate(user=test_data["passenger"])
        url = reverse("nearby-vehicles")
        response = api_client.get(url, {"lat": 12.9716, "lng": 77.5946, "radius": 5000})
        assert response.status_code == status.HTTP_200_OK
        assert response.data["success"] is True
        assert len(response.data["data"]) > 0
        assert response.data["data"][0]["vehicle_id"] == str(test_data["vehicle"].id)
