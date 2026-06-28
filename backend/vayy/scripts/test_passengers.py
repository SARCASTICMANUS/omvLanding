#!/usr/bin/env python
"""
Dummy Passenger Test Script
===========================
Creates test passengers near route stops so the driver's
"Find Passengers" screen has real data to display.

Usage:
    python manage.py shell < scripts/test_passengers.py

    OR inside Django shell:
    >>> exec(open('scripts/test_passengers.py').read())
"""

import os
import sys
import django

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "vayy.settings")
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
django.setup()

from django.contrib.gis.geos import Point
from django.utils import timezone
from datetime import timedelta
from accounts.models import User, PublicPassengerProfile
from transport.models import Route, Stop

PASSENGERS = [
    {
        "email": "ravi@test.com",
        "first_name": "Ravi",
        "last_name": "Kumar",
        "lat": 26.8525,
        "lon": 80.9489,
        "near_stop_hint": "Hazratganj",
    },
    {
        "email": "priya@test.com",
        "first_name": "Priya",
        "last_name": "Singh",
        "lat": 26.8611,
        "lon": 80.9228,
        "near_stop_hint": "Lalbagh",
    },
    {
        "email": "amit@test.com",
        "first_name": "Amit",
        "last_name": "Verma",
        "lat": 26.8450,
        "lon": 80.9350,
        "near_stop_hint": "Aminabad",
    },
    {
        "email": "sneha@test.com",
        "first_name": "Sneha",
        "last_name": "Patel",
        "lat": 26.8700,
        "lon": 80.9550,
        "near_stop_hint": "Kapoorthala",
    },
    {
        "email": "rahul@test.com",
        "first_name": "Rahul",
        "last_name": "Yadav",
        "lat": 26.8300,
        "lon": 80.9200,
        "near_stop_hint": "Charbagh",
    },
]


def create_or_update_passenger(data):
    email = data["email"]
    user, created = User.objects.get_or_create(
        email=email,
        defaults={
            "first_name": data["first_name"],
            "last_name": data["last_name"],
            "role": "passenger",
            "username": email.split("@")[0],
            "is_verified": True,
        },
    )
    if not created:
        user.first_name = data["first_name"]
        user.last_name = data["last_name"]
        user.role = "passenger"
        user.is_verified = True
        user.set_password("test1234")
        user.save()

    profile, _ = PublicPassengerProfile.objects.get_or_create(user=user)
    profile.display_name = f"{data['first_name']} {data['last_name']}"
    profile.current_location = Point(data["lon"], data["lat"], srid=4326)
    profile.last_active_at = timezone.now()
    profile.save()

    status = "CREATED" if created else "UPDATED"
    print(f"  {status}: {user.get_full_name()} ({email}) at ({data['lat']}, {data['lon']})")

    return user


def link_to_routes():
    routes = Route.objects.all()
    for user in User.objects.filter(role="passenger", email__endswith="@test.com"):
        profile = PublicPassengerProfile.objects.filter(user=user).first()
        if profile and routes.exists():
            route = routes.first()
            profile.saved_routes.add(route)
            print(f"  Linked {user.get_full_name()} to route {route.name}")


def main():
    print("=" * 60)
    print("VAYY Dummy Passenger Test Script")
    print("=" * 60)

    print("\n1. Creating/updating test passengers...")
    for p in PASSENGERS:
        create_or_update_passenger(p)

    print("\n2. Linking passengers to routes...")
    link_to_routes()

    print("\n3. Verifying setup...")
    active_passengers = PublicPassengerProfile.objects.filter(
        current_location__isnull=False,
        last_active_at__gte=timezone.now() - timedelta(minutes=30),
    ).select_related("user")

    print(f"   Active passengers with location: {active_passengers.count()}")
    for p in active_passengers:
        print(f"   - {p.user.get_full_name()} at ({p.current_location.y}, {p.current_location.x})")

    routes_with_passengers = Route.objects.filter(saved_by__isnull=False).distinct()
    print(f"   Routes with saved passengers: {routes_with_passengers.count()}")
    for r in routes_with_passengers:
        print(f"   - {r.name} (ID: {r.id})")

    print("\n" + "=" * 60)
    print("Done! Now open the driver app and:")
    print("1. Go to DriverRoutes tab")
    print("2. Select a route")
    print("3. You should see passengers on the map")
    print("=" * 60)


if __name__ == "__main__":
    main()
