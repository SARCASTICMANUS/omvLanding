import json
from django.urls import reverse
from rest_framework.test import APITestCase
from rest_framework import status
from core.models import City, Route, Stop, TripSchedule, StopTime
from django.core.files.uploadedfile import SimpleUploadedFile
import uuid

class BulkImportTests(APITestCase):
    def setUp(self):
        self.city = City.objects.create(name="Test City")
        self.url = "/api/admin/routes/bulk-import/"

    def test_json_bulk_import_success(self):
        payload = [
            {
                "name": "Route 101",
                "bus_number": "B101",
                "city_id": str(self.city.id),
                "stops": [
                    {"name": "Stop A", "lat": 12.0, "lon": 77.0, "order": 0},
                    {"name": "Stop B", "lat": 12.1, "lon": 77.1, "order": 1}
                ],
                "schedules": [
                    {
                        "label": "Morning",
                        "start_time": "08:00:00",
                        "stop_times": [
                            {"stop_name": "Stop A", "arrival_time": "08:00:00"},
                            {"stop_name": "Stop B", "arrival_time": "08:15:00"}
                        ]
                    }
                ]
            }
        ]
        
        json_file = SimpleUploadedFile(
            "routes.json",
            json.dumps(payload).encode("utf-8"),
            content_type="application/json"
        )
        
        response = self.client.post(self.url, {"file": json_file}, format="multipart")
        
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data["success"], 1)
        self.assertEqual(response.data["total"], 1)
        
        # Verify DB records
        self.assertEqual(Route.objects.count(), 1)
        route = Route.objects.first()
        self.assertEqual(route.name, "Route 101")
        self.assertEqual(route.stops.count(), 2)
        
        self.assertEqual(TripSchedule.objects.count(), 1)
        schedule = TripSchedule.objects.first()
        self.assertEqual(schedule.label, "Morning")
        self.assertEqual(schedule.stop_times.count(), 2)

    def test_json_bulk_import_validation_error(self):
        # Missing stops
        payload = [
            {
                "name": "Invalid Route",
                "city_id": str(self.city.id),
                "stops": []
            }
        ]
        
        json_file = SimpleUploadedFile(
            "routes.json",
            json.dumps(payload).encode("utf-8"),
            content_type="application/json"
        )
        
        response = self.client.post(self.url, {"file": json_file}, format="multipart")
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["success"], 0)
        self.assertEqual(response.data["failed"], 1)
        self.assertIn("stops", str(response.data["errors"][0]["reason"]))
