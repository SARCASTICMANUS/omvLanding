import json
import requests
import uuid

BASE_URL = "http://localhost:8000/api"

def test_json_import():
    # 1. Create a dummy city first
    city_name = f"Test City {uuid.uuid4().hex[:6]}"
    # We might need to bypass auth or use a token if I added permission_classes
    # For now, I'll assume it's AllowAny or I'll check the views.py again.
    
    # BulkImportView in views.py currently has:
    # # permission_classes = [IsAuthenticated] # Optional
    # Which means it defaults to the global setting.
    # Global setting in settings.py? Let's check.
    
    import_data = [
        {
            "name": "Route A",
            "bus_number": "101",
            "start_name": "Station A",
            "end_name": "Station C",
            "stops": [
                {"name": "Station A", "lat": 12.345, "lon": 78.901, "order": 0},
                {"name": "Station B", "lat": 12.346, "lon": 78.902, "order": 1},
                {"name": "Station C", "lat": 12.347, "lon": 78.903, "order": 2}
            ],
            "schedules": [
                {
                    "label": "Morning",
                    "start_time": "08:00:00",
                    "stop_times": [
                        {"stop_name": "Station A", "arrival_time": "08:00:00"},
                        {"stop_name": "Station B", "arrival_time": "08:10:00"},
                        {"stop_name": "Station C", "arrival_time": "08:20:00"}
                    ]
                }
            ]
        }
    ]
    
    with open("test_import.json", "w") as f:
        json.dump(import_data, f)
    
    files = {"file": open("test_import.json", "rb")}
    data = {"city_id": ""} # No city id for now, might fail if model requires it
    
    # Actually, I should probably check if I can run this against a live server.
    # Since I cannot easily run a server and hit it, I'll just verify the logic by code review.
    # Or I can try to run it via manage.py test if I write a Django test.
    
    print("Test file 'test_import.json' created.")

if __name__ == "__main__":
    test_json_import()
