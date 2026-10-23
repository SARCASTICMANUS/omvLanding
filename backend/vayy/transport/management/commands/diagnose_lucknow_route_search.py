"""Read-only counts and ordered-stop candidates for the SGPGI to IIM search."""
import json

from django.contrib.gis.geos import Point
from django.core.management.base import BaseCommand, CommandError
from django.db.models import Count

from transport.models import City, CityAdminConfiguration, Route, RouteStopAssociation, Stop
from transport.services.route_search_service import RouteSearchService
from transport.services.stop_discovery_service import StopDiscoveryService


class Command(BaseCommand):
    help = "Report Lucknow route/stop readiness and valid SGPGI-to-IIM directions."

    def add_arguments(self, parser):
        parser.add_argument("--city", default="lucknow")
        parser.add_argument("--pickup-lat", type=float, default=26.7435744)
        parser.add_argument("--pickup-lng", type=float, default=80.9451722)
        parser.add_argument("--destination-lat", type=float, default=26.9363415)
        parser.add_argument("--destination-lng", type=float, default=80.8980289)

    def handle(self, *args, **options):
        city_key = options["city"].strip()
        city = City.objects.filter(slug__iexact=city_key).first()
        if city is None:
            city = City.objects.filter(name__iexact=city_key).first()
        if city is None:
            raise CommandError(f"City {city_key!r} was not found; no database rows were changed.")

        config = CityAdminConfiguration.objects.filter(city=city).first()
        radius = config.max_walk_to_stop_m if config else 3000
        routes = Route.objects.filter(city=city)
        route_stops = Stop.objects.filter(route__city=city)
        global_stops = Stop.objects.filter(city=city, is_global=True)
        associations = RouteStopAssociation.objects.filter(route__city=city)
        ordered_routes = routes.annotate(stop_count=Count("stops", distinct=True)).filter(stop_count__gte=2)

        pickup = Point(options["pickup_lng"], options["pickup_lat"], srid=4326)
        destination = Point(options["destination_lng"], options["destination_lat"], srid=4326)

        pickup_candidates = StopDiscoveryService.nearby_global_stops(city.id, pickup, radius)
        destination_candidates = StopDiscoveryService.nearby_global_stops(city.id, destination, radius)
        matching_pairs = RouteSearchService.find_associated_route_pairs(
            city.id, pickup_candidates, destination_candidates, limit=100,
        )
        matching_directions = [{
            "route_id": str(pair["route"].id),
            "route_code": pair["route"].route_code,
            "direction_name": pair["route"].direction_name,
            "pickup_stop": {"id": str(pair["pickup_stop"].id), "name": pair["pickup_stop"].name,
                            "order": pair["pickup_order"]},
            "destination_stop": {"id": str(pair["dropoff_stop"].id), "name": pair["dropoff_stop"].name,
                                 "order": pair["dropoff_order"]},
        } for pair in matching_pairs]

        location = city.location

        def stop_summary(stop):
            return {
                "id": str(stop.id), "name": stop.name,
                "coordinate_status": stop.coordinate_status,
                "boarding_allowed": stop.boarding_allowed,
                "alighting_allowed": stop.alighting_allowed,
                "distance_m": round(stop.distance_m.m),
            }

        association_counts = dict(associations.values("route_id").annotate(n=Count("id")).values_list("route_id", "n"))
        valid_associated_route_ids = {route_id for route_id, count in association_counts.items() if count >= 2}
        route_membership_ids = set(associations.values_list("route_id", flat=True).distinct())
        legacy_valid_route_ids = set(ordered_routes.exclude(pk__in=route_membership_ids).values_list("id", flat=True))

        report = {
            "city": {
                "id": str(city.pk),
                "name": city.name,
                "slug": city.slug,
                "centroid": {"lat": location.y, "lng": location.x} if location else None,
                "routing_active": config.is_active if config else None,
                "max_walk_to_stop_m": radius,
            },
            "counts": {
                "routes": routes.count(),
                "public_routes": routes.filter(is_public=True).count(),
                "routes_with_at_least_two_stops": ordered_routes.count(),
                "route_associated_stops": route_stops.count(),
                "verified_route_stops": route_stops.filter(coordinate_status="verified").count(),
                "boarding_allowed_verified_route_stops": route_stops.filter(
                    coordinate_status="verified", boarding_allowed=True,
                ).count(),
                "alighting_allowed_verified_route_stops": route_stops.filter(
                    coordinate_status="verified", alighting_allowed=True,
                ).count(),
                "global_city_stops": global_stops.count(),
                "global_stops_with_coordinates": global_stops.filter(location__isnull=False).count(),
                "global_stops_missing_coordinates": global_stops.filter(location__isnull=True).count(),
                "route_directions": routes.count(),
                "global_route_stop_associations": associations.count(),
                "global_stops_associated_with_route": associations.values("stop_id").distinct().count(),
                "routes_with_at_least_two_global_ordered_stops": len(valid_associated_route_ids),
                "routes_with_at_least_two_legacy_ordered_stops": len(legacy_valid_route_ids),
                "routes_missing_geometry": routes.filter(path__isnull=True).count(),
            },
            "search": {
                "pickup_candidates": len(pickup_candidates),
                "destination_candidates": len(destination_candidates),
                "pickup_eligible_candidates": sum(stop.boarding_allowed for stop in pickup_candidates),
                "destination_eligible_candidates": sum(stop.alighting_allowed for stop in destination_candidates),
                "pickup_stops": [stop_summary(stop) for stop in pickup_candidates[:10]],
                "destination_stops": [stop_summary(stop) for stop in destination_candidates[:10]],
                "valid_ordered_directions": matching_directions,
            },
        }
        self.stdout.write(json.dumps(report, indent=2, default=str))
