#!/usr/bin/env python
"""
Create dummy passengers along the Lucknow → Raebareli route.
Each passenger is placed near a stop on the route.
"""
import os, sys, django

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "vayy.settings")
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
django.setup()

from django.contrib.gis.geos import Point
from django.utils import timezone
from accounts.models import User, PublicPassengerProfile
from transport.models import Route, Stop

ROUTE_ID = "f4ebfa80-f532-40ac-91cd-081716e48619"

PASSENGERS = [
    # Near Lucknow stop
    {"email": "ravi@test.com",    "first_name": "Ravi",   "last_name": "Kumar",   "lat": 26.8400, "lon": 80.9370},
    {"email": "priya@test.com",   "first_name": "Priya",  "last_name": "Singh",   "lat": 26.8360, "lon": 80.9320},
    # Near Stop 1 (~26.6821, 80.9821 — between Lucknow and Raebareli)
    {"email": "amit@test.com",    "first_name": "Amit",   "last_name": "Verma",   "lat": 26.6850, "lon": 80.9800},
    {"email": "sneha@test.com",   "first_name": "Sneha",  "last_name": "Patel",   "lat": 26.6800, "lon": 80.9850},
    # Near Stop 2 (~26.4706, 81.1114)
    {"email": "rahul@test.com",   "first_name": "Rahul",  "last_name": "Yadav",   "lat": 26.4720, "lon": 81.1100},
    {"email": "neha@test.com",    "first_name": "Neha",   "last_name": "Gupta",   "lat": 26.4690, "lon": 81.1130},
    # Near Stop 3 (~26.2211, 81.2557)
    {"email": "vikram@test.com",  "first_name": "Vikram", "last_name": "Singh",   "lat": 26.2230, "lon": 81.2540},
    {"email": "pooja@test.com",   "first_name": "Pooja",  "last_name": "Sharma",  "lat": 26.2190, "lon": 81.2570},
    # Near Raebareli stop (~26.2087, 81.2186)
    {"email": "deepak@test.com",  "first_name": "Deepak", "last_name": "Tiwari",  "lat": 26.2100, "lon": 81.2200},
    {"email": "ankita@test.com",  "first_name": "Ankita", "last_name": "Mishra",  "lat": 26.2070, "lon": 81.2170},
]

try:
    route = Route.objects.get(id=ROUTE_ID)
except Route.DoesNotExist:
    print(f"Route {ROUTE_ID} not found!")
    sys.exit(1)

stops = route.stops.all().order_by("order")
print(f"Route: {route.name}")
print(f"Stops: {stops.count()}")
for s in stops:
    print(f"  {s.order}. {s.name} ({s.location.y:.4f}, {s.location.x:.4f})")
print()

created_count = 0
updated_count = 0

for p in PASSENGERS:
    user, created = User.objects.get_or_create(
        email=p["email"],
        defaults={
            "first_name": p["first_name"],
            "last_name": p["last_name"],
            "role": "passenger",
            "username": p["email"].split("@")[0],
            "is_verified": True,
        },
    )
    user.first_name = p["first_name"]
    user.last_name = p["last_name"]
    user.role = "passenger"
    user.is_verified = True
    user.set_password("test1234")
    user.save()

    profile, _ = PublicPassengerProfile.objects.get_or_create(user=user)
    profile.display_name = f"{p['first_name']} {p['last_name']}"
    profile.current_location = Point(p["lon"], p["lat"], srid=4326)
    profile.last_active_at = timezone.now()
    profile.save()

    profile.saved_routes.add(route)

    if created:
        created_count += 1
        status = "CREATED"
    else:
        updated_count += 1
        status = "UPDATED"

    # Find which stop they're nearest
    nearest_stop = min(stops, key=lambda s: profile.current_location.distance(s.location))
    dist_m = profile.current_location.distance(nearest_stop.location) * 111000
    print(f"  {status}: {user.get_full_name()} ({p['email']}) → near {nearest_stop.name} ({dist_m:.0f}m)")

print()
print(f"Summary: {created_count} created, {updated_count} updated")
print(f"Total passengers on route: {PublicPassengerProfile.objects.filter(saved_routes=route).count()}")
print()
print("Done! Test the driver flow:")
print("  1. Open driver app → Routes tab")
print("  2. Enter pickup: Lucknow, destination: Raebareli")
print("  3. Tap 'Find Best Route' → select route")
print("  4. See passengers on map!")
