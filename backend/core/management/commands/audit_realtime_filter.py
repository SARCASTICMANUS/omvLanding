import time
import json
from core.services.redis_service import get_redis_client
from django.core.management.base import BaseCommand
from django.contrib.gis.geos import Point, LineString
from django.utils import timezone
from django.contrib.auth import get_user_model
from core.models import City, Route, Stop, Vehicle, ActiveTrip
from rest_framework.test import APIClient
import os

User = get_user_model()

class Command(BaseCommand):
    help = 'Audit realtime active trips filter functionality with 2 drivers and 5 passengers'

    def handle(self, *args, **options):
        self.stdout.write(self.style.SUCCESS('--- Starting Realtime Filter Audit ---'))

        # 1. Setup Test Data
        self.stdout.write('Setting up test data...')
        city, _ = City.objects.get_or_create(name="AuditCity", state="AuditState")

        # Create a passenger for authentication
        passenger_user, _ = User.objects.get_or_create(
            email="passenger_audit@test.com", 
            defaults={"username":"passenger_audit", "role":"passenger"}
        )

        # 2. Routes

        # 30.7333, 76.7794 (Chandigarh area for scale)
        p1 = (76.7794, 30.7333) # A
        p2 = (76.7794, 30.7233) # B
        p3 = (76.7794, 30.7133) # C
        p4 = (76.7794, 30.7033) # D
        
        route1, _ = Route.objects.get_or_create(
            name="North-South Express",
            city=city,
            defaults={
                "path": LineString(p1, p2, p3, p4, srid=4326),
                "bus_number": "NS-101",
                "is_public": True
            }
        )
        Stop.objects.get_or_create(route=route1, name="Stop A", order=0, location=Point(p1, srid=4326))
        Stop.objects.get_or_create(route=route1, name="Stop B", order=1, location=Point(p2, srid=4326))
        Stop.objects.get_or_create(route=route1, name="Stop C", order=2, location=Point(p3, srid=4326))
        Stop.objects.get_or_create(route=route1, name="Stop D", order=3, location=Point(p4, srid=4326))

        # Route 2: East to West
        e1 = (76.7894, 30.7183) # E
        e2 = (76.7794, 30.7183) # F (Intersection area)
        e3 = (76.7694, 30.7183) # G
        
        route2, _ = Route.objects.get_or_create(
            name="East-West Link",
            city=city,
            defaults={
                "path": LineString(e1, e2, e3, srid=4326),
                "bus_number": "EW-202",
                "is_public": True
            }
        )
        Stop.objects.get_or_create(route=route2, name="Stop E", order=0, location=Point(e1, srid=4326))
        Stop.objects.get_or_create(route=route2, name="Stop F", order=1, location=Point(e2, srid=4326))
        Stop.objects.get_or_create(route=route2, name="Stop G", order=2, location=Point(e3, srid=4326))

        # 2. Drivers and Active Trips
        d1_user, _ = User.objects.get_or_create(email="driver1@test.com", defaults={"username":"driver1", "role":"driver"})
        d2_user, _ = User.objects.get_or_create(email="driver2@test.com", defaults={"username":"driver2", "role":"driver"})
        
        v1, _ = Vehicle.objects.get_or_create(vehicle_number="V1", defaults={"driver": d1_user, "city": city, "route": route1})
        v2, _ = Vehicle.objects.get_or_create(vehicle_number="V2", defaults={"driver": d2_user, "city": city, "route": route2})

        trip1, _ = ActiveTrip.objects.update_or_create(
            driver=d1_user, route=route1, 
            defaults={"status": "active", "vehicle": v1, "current_location": Point(p1, srid=4326)}
        )
        trip2, _ = ActiveTrip.objects.update_or_create(
            driver=d2_user, route=route2, 
            defaults={"status": "active", "vehicle": v2, "current_location": Point(e1, srid=4326)}
        )

        # Connect to Redis to simulate realtime location
        r = get_redis_client()
        
        def update_loc(trip_id, lon, lat):
            r.set(f"driver_pos:{trip_id}", f"{lon},{lat}")
            ActiveTrip.objects.filter(id=trip_id).update(current_location=Point(lon, lat, srid=4326), last_updated=timezone.now())

        # 3. Test Cases / Passengers
        # We'll use APIClient to call the API
        client = APIClient()
        client.force_authenticate(user=passenger_user)
        
        passengers = [
            {"name": "P1 (A -> C)", "pickup": {"lat": 30.7333, "lon": 76.7794}, "dest": {"lat": 30.7133, "lon": 76.7794}},
            {"name": "P2 (C -> D)", "pickup": {"lat": 30.7133, "lon": 76.7794}, "dest": {"lat": 30.7033, "lon": 76.7794}},
            {"name": "P3 (E -> G)", "pickup": {"lat": 30.7183, "lon": 76.7894}, "dest": {"lat": 30.7183, "lon": 76.7694}},
            {"name": "P4 (B -> A) WRONG DIR", "pickup": {"lat": 30.7233, "lon": 76.7794}, "dest": {"lat": 30.7333, "lon": 76.7794}},
            {"name": "P5 (Out of range)", "pickup": {"lat": 31.0000, "lon": 77.0000}, "dest": {"lat": 31.0100, "lon": 77.0100}},
        ]

        def check_all(stage_name):
            self.stdout.write(self.style.MIGRATE_HEADING(f"\n--- Checking: {stage_name} ---"))
            for p in passengers:
                response = client.post('/api/passenger/filtered-trips/', 
                    data=json.dumps({"pickup": p["pickup"], "destination": p["dest"]}),
                    content_type='application/json'
                )
                results = response.json()
                trips_found = [t['bus_number'] for t in results]
                self.stdout.write(f"{p['name']}: Found {len(results)} trips: {trips_found}")

        # STAGE 1: Both at start
        update_loc(trip1.id, p1[0], p1[1])
        update_loc(trip2.id, e1[0], e1[1])
        check_all("Both vehicles at start of route")

        # STAGE 2: Driver 1 moves to Point B (middle of route)
        self.stdout.write("\nSimulating Driver 1 moving to Point B...")
        update_loc(trip1.id, p2[0], p2[1])
        check_all("Driver 1 at Point B")
        # EXPECTATION: P1 (A->C) might still see it if they are AT Point B, but if they are AT Point A, it should disappear
        # P1 pickup is exactly at A. Since Driver is at B, Driver has passed A.
        # So P1 should find 0 trips from NS-101.

        # STAGE 3: Driver 1 moves past Point C
        self.stdout.write("\nSimulating Driver 1 moving past Point C...")
        update_loc(trip1.id, 76.7794, 30.7100) # Slightly past C
        check_all("Driver 1 past Point C")
        # EXPECTATION: P2 (C->D) should now also see 0 trips for NS-101.

        self.stdout.write(self.style.SUCCESS('\n--- Audit Complete ---'))
