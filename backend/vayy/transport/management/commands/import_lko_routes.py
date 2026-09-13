"""
Management command to import LKO (Lucknow) routes and stops from the
OMV_Lucknow_Route_Stop_Master.xlsx file.

Usage:
    python manage.py import_lko_routes
    python manage.py import_lko_routes --excel /path/to/file.xlsx
    python manage.py import_lko_routes --dry-run
"""

import os
import sys
from pathlib import Path

import openpyxl
from django.contrib.gis.geos import Point, LineString
from django.core.management.base import BaseCommand, CommandError
from django.db import transaction

from transport.models import City, Route, Stop


# Default Excel path relative to this file
DEFAULT_EXCEL_PATH = Path(__file__).resolve().parent.parent.parent.parent.parent.parent / "vayy_app" / "assets" / "OMV_Lucknow_Route_Stop_Master.xlsx"

# Approximate center of Lucknow (for City location)
LUCKNOW_CENTER_LON = 80.9462
LUCKNOW_CENTER_LAT = 26.8467


class Command(BaseCommand):
    help = "Import Lucknow (LKO) routes and stops from Excel master file."

    def add_arguments(self, parser):
        parser.add_argument(
            "--excel",
            type=str,
            default=str(DEFAULT_EXCEL_PATH),
            help="Path to the Excel file (default: assets/OMV_Lucknow_Route_Stop_Master.xlsx)",
        )
        parser.add_argument(
            "--dry-run",
            action="store_true",
            help="Print what would be created without writing to DB.",
        )

    def handle(self, *args, **options):
        excel_path = options["excel"]
        dry_run = options["dry_run"]

        if not os.path.exists(excel_path):
            raise CommandError(f"Excel file not found: {excel_path}")

        self.stdout.write(self.style.NOTICE(f"Reading Excel: {excel_path}"))
        wb = openpyxl.load_workbook(excel_path, read_only=True)

        # Collect LKO route sheets
        lko_sheets = [s for s in wb.sheetnames if s.startswith("LKO-")]
        if not lko_sheets:
            raise CommandError("No LKO-* sheets found in the Excel file.")

        self.stdout.write(self.style.NOTICE(f"Found {len(lko_sheets)} LKO route sheets: {', '.join(lko_sheets)}"))

        routes_data = []
        for sheet_name in lko_sheets:
            ws = wb[sheet_name]
            route_info = self._parse_route_sheet(ws, sheet_name)
            if route_info:
                routes_data.append(route_info)

        wb.close()

        # Print summary
        total_stops = sum(r["stop_count"] for r in routes_data)
        unique_stops = set()
        for r in routes_data:
            for s in r["stops"]:
                unique_stops.add(s["name"])

        self.stdout.write(self.style.NOTICE(f"\n{'='*60}"))
        self.stdout.write(self.style.NOTICE(f"IMPORT SUMMARY"))
        self.stdout.write(self.style.NOTICE(f"{'='*60}"))
        self.stdout.write(f"  Routes:       {len(routes_data)}")
        self.stdout.write(f"  Total stops:  {total_stops}")
        self.stdout.write(f"  Unique stops: {len(unique_stops)}")
        self.stdout.write(self.style.NOTICE(f"{'='*60}\n"))

        for r in routes_data:
            self.stdout.write(
                f"  {r['route_id']}: {r['start']} -> {r['end']}  "
                f"({r['stop_count']} stops, via: {r['via']})"
            )

        self.stdout.write("")

        if dry_run:
            self.stdout.write(self.style.WARNING("DRY RUN — no data written to database."))
            return

        # Write to database
        with transaction.atomic():
            city, _ = City.objects.get_or_create(
                name="Lucknow",
                defaults={
                    "state": "Uttar Pradesh",
                    "country": "India",
                    "location": Point(LUCKNOW_CENTER_LON, LUCKNOW_CENTER_LAT, srid=4326),
                },
            )
            self.stdout.write(self.style.SUCCESS(f"City: {city.name} ({city.id})"))

            for route_data in routes_data:
                route = self._create_route(city, route_data)
                self._create_stops(route, route_data["stops"])

        self.stdout.write(self.style.SUCCESS(f"\nDone! Imported {len(routes_data)} routes into '{city.name}'."))

    def _parse_route_sheet(self, ws, sheet_name):
        """Extract route metadata and stops from a single LKO sheet."""
        rows = list(ws.iter_rows(values_only=True))

        # Row indexing (0-based): row[0]=row1, row[1]=row2, etc.
        # row[1] = Route info row
        # row[2] = End info row
        # row[3] = Stop count row
        # row[6] = Header row ['Stop Seq', 'Stop Name', 'Role', 'Direction']
        # row[7:] = Stop data

        if len(rows) < 8:
            self.stdout.write(self.style.WARNING(f"  Skipping {sheet_name}: not enough rows"))
            return None

        route_row = list(rows[1])   # Row 2 in Excel
        end_row = list(rows[2])     # Row 3 in Excel
        stop_count_row = list(rows[3])  # Row 4 in Excel

        route_id = sheet_name
        route_name = route_row[1] if len(route_row) > 1 else sheet_name
        start_point = route_row[3] if len(route_row) > 3 else ""
        end_point = end_row[1] if len(end_row) > 1 else ""
        via = end_row[3] if len(end_row) > 3 else ""
        stop_count = int(stop_count_row[1]) if stop_count_row[1] else 0

        stops = []
        for row in rows[7:]:  # Start from row 8 (0-indexed: 7)
            if row[0] is None or row[1] is None:
                continue
            stops.append({
                "seq": int(row[0]),
                "name": str(row[1]).strip(),
                "role": str(row[2]).strip() if row[2] else "INTERMEDIATE",
                "direction": str(row[3]).strip() if row[3] else "",
            })

        return {
            "route_id": route_id,
            "route_name": route_name,
            "start": start_point,
            "end": end_point,
            "via": via,
            "stop_count": stop_count or len(stops),
            "stops": stops,
        }

    def _create_route(self, city, route_data):
        """Create or get a Route record. Uses placeholder geometry."""
        # Generate a simple placeholder LineString along Lucknow
        # spread stops roughly across the city
        n = route_data["stop_count"]
        coords = self._generate_placeholder_coords(n, route_data["route_id"])

        path = LineString(coords, srid=4326)

        route, created = Route.objects.update_or_create(
            city=city,
            route_code=route_data["route_id"],
            defaults={
                "name": route_data["route_name"],
                "path": path,
                "start_name": route_data["start"],
                "end_name": route_data["end"],
                "total_distance_meters": 0,
                "is_public": True,
            },
        )

        action = "Created" if created else "Updated"
        self.stdout.write(self.style.SUCCESS(f"  {action} Route: {route.name} ({route.route_code})"))
        return route

    def _create_stops(self, route, stops_data):
        """Create Stop records for a route."""
        # Delete existing stops for this route (in case of re-import)
        Stop.objects.filter(route=route).delete()

        n = len(stops_data)
        coords = self._generate_placeholder_coords(n, route.route_code)

        for i, stop_data in enumerate(stops_data):
            lon, lat = coords[i]
            location = Point(lon, lat, srid=4326)

            # Build a simple geometry segment to next stop
            geometry = None
            if i < n - 1:
                next_lon, next_lat = coords[i + 1]
                geometry = LineString(
                    [(lon, lat), (next_lon, next_lat)],
                    srid=4326,
                )

            Stop.objects.create(
                route=route,
                name=stop_data["name"],
                location=location,
                order=stop_data["seq"],
                geometry=geometry,
                cumulative_distance_m=0,
                cumulative_duration_s=0,
            )

        self.stdout.write(f"    Created {len(stops_data)} stops for {route.route_code}")

    def _generate_placeholder_coords(self, n, route_code):
        """
        Generate n coordinate pairs spread across Lucknow as placeholders.
        Different routes get slightly different offsets to avoid all stops
        landing on the same line.
        """
        # Base offset per route code number
        try:
            route_num = int(route_code.split("-")[1])
        except (IndexError, ValueError):
            route_num = 1

        # Spread stops in a rough line across Lucknow
        # Lucknow roughly spans: lat 26.75-26.95, lon 80.85-81.05
        base_lon = 80.9462
        base_lat = 26.8467

        # Add a small offset per route so routes don't overlap exactly
        route_offset_lon = (route_num % 7) * 0.005 - 0.015
        route_offset_lat = (route_num % 5) * 0.004 - 0.008

        coords = []
        for i in range(n):
            if n <= 1:
                t = 0.5
            else:
                t = i / (n - 1)

            # Spread along a diagonal across the city
            lon = base_lon + route_offset_lon + (t - 0.5) * 0.08
            lat = base_lat + route_offset_lat + (t - 0.5) * 0.06

            coords.append((round(lon, 6), round(lat, 6)))

        return coords
