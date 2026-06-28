from django.core.management.base import BaseCommand
from django.contrib.gis.geos import Point
from django.utils import timezone
from datetime import timedelta
from accounts.models import User, PublicPassengerProfile
from transport.models import Route


PASSENGERS = [
    {"email": "ravi@test.com", "first_name": "Ravi", "last_name": "Kumar", "lat": 26.8525, "lon": 80.9489},
    {"email": "priya@test.com", "first_name": "Priya", "last_name": "Singh", "lat": 26.8611, "lon": 80.9228},
    {"email": "amit@test.com", "first_name": "Amit", "last_name": "Verma", "lat": 26.8450, "lon": 80.9350},
    {"email": "sneha@test.com", "first_name": "Sneha", "last_name": "Patel", "lat": 26.8700, "lon": 80.9550},
    {"email": "rahul@test.com", "first_name": "Rahul", "last_name": "Yadav", "lat": 26.8300, "lon": 80.9200},
]


class Command(BaseCommand):
    help = "Create dummy passengers near route stops for testing"

    def handle(self, *args, **options):
        self.stdout.write(self.style.SUCCESS("Creating dummy passengers..."))

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
            user.save()

            profile, _ = PublicPassengerProfile.objects.get_or_create(user=user)
            profile.display_name = f"{p['first_name']} {p['last_name']}"
            profile.current_location = Point(p["lon"], p["lat"], srid=4326)
            profile.last_active_at = timezone.now()
            profile.save()

            status = "CREATED" if created else "UPDATED"
            self.stdout.write(f"  {status}: {user.get_full_name()} at ({p['lat']}, {p['lon']})")

        route = Route.objects.first()
        if route:
            for user in User.objects.filter(role="passenger", email__endswith="@test.com"):
                profile = PublicPassengerProfile.objects.filter(user=user).first()
                if profile:
                    profile.saved_routes.add(route)
                    self.stdout.write(f"  Linked {user.get_full_name()} to route {route.name}")

        count = PublicPassengerProfile.objects.filter(
            current_location__isnull=False,
            last_active_at__gte=timezone.now() - timedelta(minutes=30),
        ).count()
        self.stdout.write(self.style.SUCCESS(f"\nDone! {count} active passengers with location."))
        self.stdout.write("Now test the driver flow: Home > Find Best Route > Select Route > Passengers Map")
