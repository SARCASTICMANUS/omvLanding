#!/usr/bin/env python
"""
Quick test: place one passenger near a stop and verify the API sees them.

Usage:
    docker exec vayy-web python scripts/test_single_passenger.py

Then in driver app:
  1. Search Lucknow → Raebareli
  2. Select the route
  3. You should see 1 passenger on the map near the stop you chose
"""
import os, sys, django, time, random

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "vayy.settings")
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
django.setup()

from django.contrib.gis.geos import Point
from django.utils import timezone
from accounts.models import User, PublicPassengerProfile
from transport.models import Route, Stop

ROUTE_ID = "f4ebfa80-f532-40ac-91cd-081716e48619"
TEST_PASSENGER = {
    "email": "testpassenger@test.com",
    "first_name": "Test",
    "last_name": "Passenger",
}

def main():
    route = Route.objects.get(id=ROUTE_ID)
    stops = list(route.stops.all().order_by("order"))

    print("=" * 60)
    print("Single Passenger Test")
    print(f"Route: {route.name} ({len(stops)} stops)")
    print("=" * 60)

    # Create or get passenger
    user, _ = User.objects.get_or_create(
        email=TEST_PASSENGER["email"],
        defaults={
            "first_name": TEST_PASSENGER["first_name"],
            "last_name": TEST_PASSENGER["last_name"],
            "role": "passenger",
            "username": TEST_PASSENGER["email"].split("@")[0],
            "is_verified": True,
        },
    )
    user.first_name = TEST_PASSENGER["first_name"]
    user.last_name = TEST_PASSENGER["last_name"]
    user.role = "passenger"
    user.is_verified = True
    user.set_password("test1234")
    user.save()

    profile, _ = PublicPassengerProfile.objects.get_or_create(user=user)
    profile.display_name = f"{TEST_PASSENGER['first_name']} {TEST_PASSENGER['last_name']}"
    profile.saved_routes.add(route)

    # Pick random stop
    stop = random.choice(stops)
    lat = stop.location.y + random.uniform(-0.001, 0.001)
    lon = stop.location.x + random.uniform(-0.001, 0.001)
    profile.current_location = Point(lon, lat, srid=4326)
    profile.last_active_at = timezone.now()
    profile.save()

    print(f"Passenger: {user.get_full_name()} ({user.email})")
    print(f"Placed at: ({lat:.4f}, {lon:.4f})")
    print(f"Near stop: {stop.name}")
    print(f"Distance: {profile.current_location.distance(stop.location) * 111000:.0f}m")
    print()
    print("Now check the driver app:")
    print("  1. Search Lucknow → Raebareli")
    print("  2. Select the route")
    print(f"  3. You should see '{user.get_full_name()}' near {stop.name}")
    print()
    print("Press Ctrl+C to stop. Passenger stays active for 10 minutes.")

    # Keep updating last_active_at so passenger stays visible
    try:
        while True:
            time.sleep(30)
            profile.last_active_at = timezone.now()
            profile.save()
            print(f"  [{timezone.now().strftime('%H:%M:%S')}] Still active near {stop.name}")
    except KeyboardInterrupt:
        print("\nDone.")


if __name__ == "__main__":
    main()
