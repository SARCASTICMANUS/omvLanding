"""Ensure a city has a resolvable, active service-city record for dynamic routing.

`DynamicRoutePreviewAPIView` resolves its service city with a fallback chain
(`transport.api.dynamic_admin_views._resolve_city`). The coordinate-based branch
only sees cities whose `location` is populated, and the single-configured-city
branch only fires when exactly one city is active. A city row with a NULL
`location` is therefore invisible to both branches, and any trip planned inside
it returns 400 "Unable to determine a service city".

This command fills in a city's `location` and guarantees an active
`CityAdminConfiguration` so the coordinate branch can resolve it.

Safe to run repeatedly: an existing non-null location is left untouched unless
--force is passed. It never imports or rewrites route/stop data.

Usage:
    python manage.py ensure_lucknow_service_city
    python manage.py ensure_lucknow_service_city --city noida \\
        --lat 28.5706 --lng 77.3272 --state "Uttar Pradesh"
    python manage.py ensure_lucknow_service_city --city noida --force
"""
from django.contrib.gis.geos import Point
from django.core.management.base import BaseCommand, CommandError
from django.db import transaction

from transport.models import City, CityAdminConfiguration
from transport.services.city_config import CITY_DEFAULTS


class Command(BaseCommand):
    help = "Ensure a city can be resolved as a service city by dynamic route preview."

    def add_arguments(self, parser):
        parser.add_argument(
            "--city",
            default="lucknow",
            help="City name or slug to ensure (case-insensitive). Default: lucknow",
        )
        parser.add_argument("--lat", type=float, help="City centroid latitude.")
        parser.add_argument("--lng", type=float, help="City centroid longitude.")
        parser.add_argument("--state", help="State name, if not already stored.")
        parser.add_argument("--country", default="India", help="Country name.")
        parser.add_argument(
            "--force",
            action="store_true",
            help="Overwrite location/state/country even if already set.",
        )
        parser.add_argument(
            "--deactivate-others",
            action="store_true",
            help=(
                "Mark every other city's config inactive. Only needed when a "
                "deployment serves a single city and the single-configured-city "
                "fallback is preferred over coordinate matching."
            ),
        )

    def handle(self, *args, **options):
        key = (options["city"] or "").strip()
        if not key:
            raise CommandError("--city must not be empty.")

        defaults = CITY_DEFAULTS.get(key.lower())
        lat = options.get("lat")
        lng = options.get("lng")

        if lat is None or lng is None:
            if defaults is None:
                raise CommandError(
                    f"No coordinates for '{key}' and none were supplied. "
                    f"Pass --lat and --lng, or use one of: "
                    f"{', '.join(sorted(CITY_DEFAULTS))}."
                )
            lat = defaults[0] if lat is None else lat
            lng = defaults[1] if lng is None else lng

        state = options.get("state") or (defaults[2] if defaults else "")
        country = options.get("country") or "India"
        force = options.get("force")

        city = (
            City.objects.filter(slug__iexact=key).first()
            or City.objects.filter(name__iexact=key).first()
        )
        created = city is None

        if created:
            city = City.objects.create(
                name=key.title(),
                state=state,
                country=country,
                location=Point(lng, lat, srid=4326),
            )
        else:
            changed_fields = []
            if city.location is None or force:
                city.location = Point(lng, lat, srid=4326)
                changed_fields.append("location")
            if (not city.state or force) and state:
                city.state = state
                changed_fields.append("state")
            if (not city.country or force) and country:
                city.country = country
                changed_fields.append("country")
            if changed_fields:
                city.save(update_fields=changed_fields)

        config, config_created = CityAdminConfiguration.objects.get_or_create(
            city=city,
            defaults={"is_active": True},
        )
        if not config.is_active:
            config.is_active = True
            config.save(update_fields=["is_active", "updated_at"])

        deactivated = []
        if options.get("deactivate_others"):
            for other in CityAdminConfiguration.objects.exclude(city=city).filter(is_active=True):
                other.is_active = False
                other.save(update_fields=["is_active", "updated_at"])
                deactivated.append(str(other.city.name))

        self.stdout.write(self.style.SUCCESS(
            f"{city.name} service city ready: id={city.id}, city_created={created}, "
            f"config_created={config_created}, active={config.is_active}, "
            f"location=({city.location.y}, {city.location.x})"
        ))

        if deactivated:
            self.stdout.write(self.style.WARNING(
                f"Deactivated other service cities: {', '.join(deactivated)}"
            ))
