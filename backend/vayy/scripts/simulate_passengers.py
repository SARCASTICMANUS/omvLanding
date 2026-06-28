#!/usr/bin/env python
"""
Simulate passengers along the Lucknow → Raebareli route in real-time.

Passengers:
  - Move along the route at walking speed
  - Randomly stop at stops (waiting for a ride)
  - Go inactive after a while (simulating someone leaving)
  - Reactivate randomly (simulating someone new searching)

The driver app polls /nearby-passengers/ every 10s,
so passengers appear, move, and disappear naturally.

Usage:
    docker exec vayy-web python scripts/simulate_passengers.py [--duration 120] [--interval 5]

Press Ctrl+C to stop.
"""
import os, sys, django, time, random, math, signal

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "vayy.settings")
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
django.setup()

from django.contrib.gis.geos import Point
from django.utils import timezone
from accounts.models import User, PublicPassengerProfile
from transport.models import Route

ROUTE_ID = "f4ebfa80-f532-40ac-91cd-081716e48619"

# Route stops as (lat, lon)
ROUTE_STOPS = [
    (26.8381, 80.9346),  # Lucknow
    (26.6821, 80.9821),  # Stop 1
    (26.4706, 81.1114),  # Stop 2
    (26.2211, 81.2557),  # Stop 3
    (26.2087, 81.2186),  # Raebareli
]

PASSENGERS = [
    {"email": "ravi@test.com",    "first_name": "Ravi",   "last_name": "Kumar"},
    {"email": "priya@test.com",   "first_name": "Priya",  "last_name": "Singh"},
    {"email": "amit@test.com",    "first_name": "Amit",   "last_name": "Verma"},
    {"email": "sneha@test.com",   "first_name": "Sneha",  "last_name": "Patel"},
    {"email": "rahul@test.com",   "first_name": "Rahul",  "last_name": "Yadav"},
    {"email": "neha@test.com",    "first_name": "Neha",   "last_name": "Gupta"},
    {"email": "vikram@test.com",  "first_name": "Vikram", "last_name": "Singh"},
    {"email": "pooja@test.com",   "first_name": "Pooja",  "last_name": "Sharma"},
    {"email": "deepak@test.com",  "first_name": "Deepak", "last_name": "Tiwari"},
    {"email": "ankita@test.com",  "first_name": "Ankita", "last_name": "Mishra"},
]

stop_event = False

def handle_signal(sig, frame):
    global stop_event
    stop_event = True
    print("\nStopping simulation...")

signal.signal(signal.SIGINT, handle_signal)
signal.signal(signal.SIGTERM, handle_signal)


def interpolate(a, b, t):
    """Linear interpolation between two lat/lon points."""
    return a + (b - a) * t


def get_position_on_route(progress):
    """Get lat/lon for a given progress (0.0 to 1.0) along the route."""
    if progress <= 0:
        return ROUTE_STOPS[0]
    if progress >= 1:
        return ROUTE_STOPS[-1]

    total_segments = len(ROUTE_STOPS) - 1
    segment = min(int(progress * total_segments), total_segments - 1)
    t = (progress * total_segments) - segment

    lat = interpolate(ROUTE_STOPS[segment][0], ROUTE_STOPS[segment + 1][0], t)
    lon = interpolate(ROUTE_STOPS[segment][1], ROUTE_STOPS[segment + 1][1], t)
    return (lat, lon)


class SimulatedPassenger:
    def __init__(self, data, route):
        self.email = data["email"]
        self.first_name = data["first_name"]
        self.last_name = data["last_name"]
        self.route = route

        # Start near a random stop (passengers wait at stops, not between them)
        self.current_stop_idx = random.randint(0, len(ROUTE_STOPS) - 1)
        self.progress = self.current_stop_idx / (len(ROUTE_STOPS) - 1)
        self.speed = random.uniform(0.001, 0.005)  # progress per tick
        self.active = True
        self.waiting_at_stop = True  # start waiting at a stop
        self.wait_timer = random.randint(1, 3)  # wait 1-3 ticks then move
        self.inactive_timer = 0

        # Create/update user and profile
        self.user, _ = User.objects.get_or_create(
            email=self.email,
            defaults={
                "first_name": self.first_name,
                "last_name": self.last_name,
                "role": "passenger",
                "username": self.email.split("@")[0],
                "is_verified": True,
            },
        )
        self.user.first_name = self.first_name
        self.user.last_name = self.last_name
        self.user.role = "passenger"
        self.user.is_verified = True
        self.user.save()

        self.profile, _ = PublicPassengerProfile.objects.get_or_create(user=self.user)
        self.profile.display_name = f"{self.first_name} {self.last_name}"
        self.profile.saved_routes.add(self.route)
        self._update_location()

    def _update_location(self):
        lat, lon = get_position_on_route(self.progress)
        # Small offset from stop center (simulating standing near the stop)
        lat += random.uniform(-0.002, 0.002)
        lon += random.uniform(-0.002, 0.002)
        self.profile.current_location = Point(lon, lat, srid=4326)
        self.profile.last_active_at = timezone.now()
        self.profile.save()

        # Publish to RabbitMQ so driver WS consumers get real-time updates
        try:
            from tracking.services.event_publisher import TrackingEventPublisher
            saved_route_ids = list(self.profile.saved_routes.values_list("id", flat=True))
            TrackingEventPublisher.publish_passenger_location({
                "user_id": str(self.user.id),
                "lat": lat,
                "lng": lon,
                "display_name": self.profile.display_name or self.user.full_name or self.email.split("@")[0],
                "route_ids": [str(r) for r in saved_route_ids],
            })
        except Exception:
            pass  # RabbitMQ may not be running; DB write still works

    def tick(self):
        if not self.active:
            # Randomly reactivate after some time
            self.inactive_timer -= 1
            if self.inactive_timer <= 0 and random.random() < 0.1:
                self.active = True
                self.progress = random.random()
                self._update_location()
                return "reactivated"
            return "inactive"

        # At a stop? Wait sometimes
        if self.waiting_at_stop:
            self.wait_timer -= 1
            if self.wait_timer <= 0:
                self.waiting_at_stop = False
                return "waiting_done"
            return "waiting"

        # Move along route
        self.progress += self.speed * random.uniform(0.5, 1.5)

        # Check if near a stop (within 0.05 of a stop position)
        for i, stop_pos in enumerate(ROUTE_STOPS):
            stop_progress = i / (len(ROUTE_STOPS) - 1)
            if abs(self.progress - stop_progress) < 0.03 and random.random() < 0.3:
                self.progress = stop_progress
                self.waiting_at_stop = True
                self.wait_timer = random.randint(2, 6)  # wait 2-6 ticks
                self._update_location()
                return "at_stop"

        # Reached end? Turn around or deactivate
        if self.progress >= 1.0:
            if random.random() < 0.5:
                self.progress = 1.0
                self.speed = -abs(self.speed)  # go back
            else:
                self.active = False
                self.inactive_timer = random.randint(5, 15)
                self.profile.current_location = None
                self.profile.save()
                return "deactivated"

        if self.progress <= 0.0:
            if random.random() < 0.5:
                self.progress = 0.0
                self.speed = abs(self.speed)
            else:
                self.active = False
                self.inactive_timer = random.randint(5, 15)
                self.profile.current_location = None
                self.profile.save()
                return "deactivated"

        self._update_location()
        return "moving"


def main():
    import argparse
    parser = argparse.ArgumentParser()
    parser.add_argument("--duration", type=int, default=120, help="Total seconds to simulate")
    parser.add_argument("--interval", type=int, default=5, help="Seconds between ticks")
    args = parser.parse_args()

    try:
        route = Route.objects.get(id=ROUTE_ID)
    except Route.DoesNotExist:
        print(f"Route {ROUTE_ID} not found!")
        sys.exit(1)

    print("=" * 60)
    print("VAYY Passenger Simulation")
    print(f"Route: Lucknow → Raebareli")
    print(f"Passengers: {len(PASSENGERS)}")
    print(f"Duration: {args.duration}s | Tick: {args.interval}s")
    print(f"Driver app polls every 10s")
    print("Press Ctrl+C to stop")
    print("=" * 60)

    passengers = [SimulatedPassenger(p, route) for p in PASSENGERS]

    tick_count = 0
    max_ticks = args.duration // args.interval

    while not stop_event and tick_count < max_ticks:
        tick_count += 1
        active_count = 0

        print(f"\n--- Tick {tick_count}/{max_ticks} ({tick_count * args.interval}s) ---")

        for sp in passengers:
            status = sp.tick()
            if sp.active:
                active_count += 1
            lat = sp.profile.current_location.y if sp.profile.current_location else None
            lon = sp.profile.current_location.x if sp.profile.current_location else None
            pos = f"({lat:.4f}, {lon:.4f})" if lat else "inactive"
            print(f"  {sp.first_name:10s} → {status:15s} {pos}")

        print(f"  Active: {active_count}/{len(passengers)}")

        if not stop_event and tick_count < max_ticks:
            time.sleep(args.interval)

    print("\n" + "=" * 60)
    print("Simulation ended")
    print("=" * 60)


if __name__ == "__main__":
    main()
