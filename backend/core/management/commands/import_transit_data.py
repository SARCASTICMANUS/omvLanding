import csv
import json
import os
from django.core.management.base import BaseCommand, CommandError
from django.contrib.gis.geos import Point, LineString
from django.db import transaction
from core.models import City, Route, Stop, TripSchedule, StopTime
from core.utils import create_route_geometry


class Command(BaseCommand):
    help = "Bulk import transit data (Cities, Routes, Stops) from a CSV or JSON file."

    def add_arguments(self, parser):
        parser.add_argument("--file", type=str, help="Path to the import file")
        parser.add_argument(
            "--format",
            type=str,
            choices=["csv", "json"],
            default="csv",
            help="Format of the input file",
        )
        parser.add_argument(
            "--city", type=str, help="Default city name for all imported routes"
        )

    def handle(self, *args, **options):
        file_path = options["file"]
        file_format = options["format"]
        default_city_name = options["city"]

        if not file_path or not os.path.exists(file_path):
            raise CommandError(f"File not found: {file_path}")

        self.stdout.write(self.style.SUCCESS(f"Starting import from {file_path}..."))

        if file_format == "csv":
            self._import_csv(file_path, default_city_name)
        else:
            self._import_json(file_path, default_city_name)

    def _import_csv(self, file_path, default_city_name):
        """
        Expects CSV with headers:
        route_name, bus_number, start_name, end_name, stop_name, stop_lat, stop_lon, stop_order, city_name
        """
        routes_data = {}

        with open(file_path, mode="r", encoding="utf-8") as f:
            reader = csv.DictReader(f)
            for row in reader:
                r_name = row["route_name"]
                city_name = row.get("city_name") or default_city_name
                
                if not r_name or not city_name:
                    continue

                if r_name not in routes_data:
                    routes_data[r_name] = {
                        "name": r_name,
                        "bus_number": row.get("bus_number", ""),
                        "start_name": row.get("start_name", ""),
                        "end_name": row.get("end_name", ""),
                        "city_name": city_name,
                        "stops": [],
                    }

                routes_data[r_name]["stops"].append(
                    {
                        "name": row["stop_name"],
                        "lat": float(row["stop_lat"]),
                        "lon": float(row["stop_lon"]),
                        "order": int(row["stop_order"]),
                    }
                )

        self._process_routes(routes_data)

    def _import_json(self, file_path, default_city_name):
        with open(file_path, mode="r", encoding="utf-8") as f:
            data = json.load(f)
            if isinstance(data, list):
                routes_data = {r["name"]: r for r in data}
                # Inject city name if needed
                for r in routes_data.values():
                    if not r.get("city_name"):
                        r["city_name"] = default_city_name
            else:
                routes_data = {data["name"]: data}
                if not data.get("city_name"):
                    data["city_name"] = default_city_name

        self._process_routes(routes_data)

    def _process_routes(self, routes_data):
        success_count = 0
        for r_name, r_info in routes_data.items():
            try:
                with transaction.atomic():
                    # 1. Get or Create City
                    city, _ = City.objects.get_or_create(name=r_info["city_name"])

                    # 2. Sort stops and create geometry
                    stops_sorted = sorted(r_info["stops"], key=lambda x: x["order"])
                    waypoints = [(s["lon"], s["lat"]) for s in stops_sorted]

                    self.stdout.write(f"Calculating geometry for route: {r_name}...")
                    route_geo = create_route_geometry(waypoints)

                    if route_geo:
                        path = route_geo["geometry"]
                        distance = route_geo["total_distance"]
                    else:
                        path = LineString(waypoints, srid=4326)
                        distance = 0

                    # 3. Create Route
                    route, created = Route.objects.update_or_create(
                        name=r_name,
                        city=city,
                        defaults={
                            "bus_number": r_info.get("bus_number", ""),
                            "start_name": r_info.get("start_name", ""),
                            "end_name": r_info.get("end_name", ""),
                            "path": path,
                            "total_distance_meters": distance,
                        },
                    )

                    # 4. Create Stops
                    Stop.objects.filter(route=route).delete()
                    for s_info in stops_sorted:
                        Stop.objects.create(
                            route=route,
                            name=s_info["name"],
                            location=Point(s_info["lon"], s_info["lat"], srid=4326),
                            order=s_info["order"],
                        )

                    success_count += 1
                    self.stdout.write(
                        self.style.SUCCESS(f"Successfully imported route: {r_name}")
                    )

            except Exception as e:
                self.stdout.write(
                    self.style.ERROR(f"Failed to import route {r_name}: {e}")
                )

        self.stdout.write(
            self.style.SUCCESS(f"Import finished. {success_count} routes processed.")
        )
