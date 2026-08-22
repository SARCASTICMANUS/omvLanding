#!/usr/bin/env python3
"""
Route-Based GPS Simulator — 10-Minute Run

Connects to the Vayy backend, pulls a real route's stops from the DB,
starts a route trip, then pushes GPS pings along the route's road geometry
for exactly 10 minutes.

Pipeline:
  Simulator → POST /start-route-trip/ → POST /driver-location/ (every 3s)
    → Django → Celery → LocationService (OSRM snap, stop detection, ETA)
    → Redis GEO + Redis route state + WebSocket broadcast

Usage:
  python3 scripts/route_gps_simulator.py \
    --api-url http://localhost:8000 \
    --email driver@gmail.com \
    --password zxcv9876 \
    --vehicle-id f3879f39-29d1-4dd3-a876-00c73c468702 \
    --route-id f4ebfa80-f532-40ac-91cd-081716e48619 \
    --duration 600

If --route-id is omitted the script lists available routes and lets you pick.
"""

import os
import sys
import time
import math
import json
import random
import signal
import logging
import argparse
from datetime import datetime, timezone
from typing import List, Tuple, Optional, Dict

import requests

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
)
logger = logging.getLogger("route_gps_simulator")


# ── helpers ──────────────────────────────────────────────────

def haversine_m(p1: Tuple[float, float], p2: Tuple[float, float]) -> float:
    """Great-circle distance in metres between (lat, lng) points."""
    lat1, lon1 = math.radians(p1[0]), math.radians(p1[1])
    lat2, lon2 = math.radians(p2[0]), math.radians(p2[1])
    dlat = lat2 - lat1
    dlon = lon2 - lon1
    a = math.sin(dlat / 2) ** 2 + math.cos(lat1) * math.cos(lat2) * math.sin(dlon / 2) ** 2
    return 2 * 6371000 * math.asin(math.sqrt(a))


def interpolate(
    p1: Tuple[float, float],
    p2: Tuple[float, float],
    fraction: float,
) -> Tuple[float, float]:
    """Linearly interpolate between two (lat, lng) points."""
    return (
        p1[0] + fraction * (p2[0] - p1[0]),
        p1[1] + fraction * (p2[1] - p1[1]),
    )


def heading_deg(p1: Tuple[float, float], p2: Tuple[float, float]) -> float:
    """Bearing in degrees from p1→p2 (both lat, lng)."""
    dlon = math.radians(p2[1] - p1[1])
    lat1 = math.radians(p1[0])
    lat2 = math.radians(p2[0])
    y = math.sin(dlon) * math.cos(lat2)
    x = math.cos(lat1) * math.sin(lat2) - math.sin(lat1) * math.cos(lat2) * math.cos(dlon)
    return (math.degrees(math.atan2(y, x)) + 360) % 360


def jitter_noise(scale: float = 0.00002) -> float:
    """Small GPS noise."""
    return random.uniform(-scale, scale)


# ── main simulator ───────────────────────────────────────────

class RouteGPSSimulator:
    """
    Pulls route geometry from the DB, moves a vehicle along it,
    and pushes GPS for a fixed duration.
    """

    def __init__(
        self,
        api_base_url: str,
        email: str,
        password: str,
        vehicle_id: str,
        route_id: str,
        direction: str = "outbound",
        duration_s: int = 600,
        interval_s: float = 3.0,
        speed_kmph: float = 25.0,
    ):
        self.api_base_url = api_base_url.rstrip("/")
        self.email = email
        self.password = password
        self.vehicle_id = vehicle_id
        self.route_id = route_id
        self.direction = direction
        self.duration_s = duration_s
        self.interval_s = interval_s
        self.base_speed = speed_kmph

        self.access_token: Optional[str] = None
        self.trip_id: Optional[str] = None
        self._running = True
        self._start_time: Optional[float] = None
        self._msg_count = 0

        # Route geometry built from stops
        self._route_points: List[Tuple[float, float]] = []  # (lat, lng)
        self._segment_lengths: List[float] = []  # metres per segment
        self._total_length_m: float = 0
        self._cursor_lat: float = 0.0
        self._cursor_lng: float = 0.0
        self._current_seg: int = 0
        self._frac_in_seg: float = 0.0

    # ── auth ─────────────────────────────────────────────────

    def authenticate(self) -> None:
        logger.info("Authenticating driver %s ...", self.email)
        resp = requests.post(
            f"{self.api_base_url}/api/accounts/login/",
            json={"email": self.email, "password": self.password},
            timeout=15,
        )
        resp.raise_for_status()
        self.access_token = resp.json()["data"]["tokens"]["access"]
        logger.info("Authentication successful")

    def _headers(self) -> dict:
        return {
            "Authorization": f"Bearer {self.access_token}",
            "Content-Type": "application/json",
        }

    # ── fetch route geometry from DB ─────────────────────────

    def fetch_route_geometry(self) -> None:
        """
        GET /api/tracking/route/{route_id}/stops/
        Build ordered (lat, lng) waypoints from the stop locations.
        If stops have a geometry LineString, interpolate intermediate points.
        """
        logger.info("Fetching route %s stops ...", self.route_id)

        resp = requests.get(
            f"{self.api_base_url}/api/tracking/route/{self.route_id}/stops/",
            headers=self._headers(),
            timeout=15,
        )

        if resp.status_code != 200:
            logger.error("Fetch route failed [%s]: %s", resp.status_code, resp.text)
            resp.raise_for_status()

        data = resp.json()

        if not data.get("success"):
            raise RuntimeError(f"Failed to fetch route stops: {data}")

        stops = data["data"].get("stops", [])
        if not stops:
            raise RuntimeError(f"Route {self.route_id} has no stops")

        logger.info("Route has %d stops:", len(stops))
        for s in stops:
            logger.info("  [%d] %s — cum_dist=%.0fm",
                        s["order"], s["name"], s.get("cumulative_distance_m", 0))

        # Build coordinate list from stop locations
        # stops come ordered by "order" from the serializer
        coords: List[Tuple[float, float]] = []
        for stop in stops:
            loc = stop.get("location")
            if isinstance(loc, dict):
                # GeoJSON format: {"type": "Point", "coordinates": [lng, lat]}
                lng = loc["coordinates"][0]
                lat = loc["coordinates"][1]
            elif isinstance(loc, str):
                # WKT format: "SRID=4326;POINT(lng lat)"
                parts = loc.split("POINT")[-1].strip().strip("()").split()
                lng, lat = float(parts[0]), float(parts[1])
            else:
                continue
            coords.append((lat, lng))

        if not coords:
            raise RuntimeError("Could not parse stop coordinates")

        # If direction is inbound, reverse
        if self.direction == "inbound":
            coords.reverse()

        self._route_points = coords

        # Compute segment lengths
        self._segment_lengths = []
        for i in range(len(coords) - 1):
            self._segment_lengths.append(haversine_m(coords[i], coords[i + 1]))
        self._total_length_m = sum(self._segment_lengths)

        logger.info(
            "Route geometry: %d points, total length %.0fm, %d segments",
            len(self._route_points), self._total_length_m, len(self._segment_lengths),
        )

        # Set initial position
        self._cursor_lat = self._route_points[0][0]
        self._cursor_lng = self._route_points[0][1]
        self._current_seg = 0
        self._frac_in_seg = 0.0

    # ── start / end trip ─────────────────────────────────────

    def start_trip(self) -> None:
        """POST /api/tracking/start-route-trip/"""
        logger.info("Starting route trip ...")
        resp = requests.post(
            f"{self.api_base_url}/api/tracking/start-route-trip/",
            json={
                "vehicle_id": self.vehicle_id,
                "route_id": self.route_id,
                "direction": self.direction,
            },
            headers=self._headers(),
            timeout=15,
        )

        if resp.status_code != 200:
            logger.error(
                "Start trip failed [%s]: %s",
                resp.status_code,
                resp.text,
            )
            resp.raise_for_status()

        data = resp.json()

        if not data.get("success"):
            raise RuntimeError(f"Failed to start trip: {data}")

        self.trip_id = data["data"]["trip_id"]
        logger.info(
            "Trip started: %s on route %s (%s)",
            self.trip_id, data["data"]["route_name"], self.direction,
        )

    def end_trip(self) -> None:
        """POST /api/tracking/end-route-trip/"""
        if not self.trip_id:
            return
        logger.info("Ending trip %s ...", self.trip_id)
        try:
            resp = requests.post(
                f"{self.api_base_url}/api/tracking/end-route-trip/",
                json={"trip_id": self.trip_id},
                headers=self._headers(),
                timeout=15,
            )
            resp.raise_for_status()
            logger.info("Trip ended successfully")
        except Exception as e:
            logger.warning("Failed to end trip gracefully: %s", e)

    # ── movement simulation ──────────────────────────────────

    def _advance_cursor(self, metres: float) -> Tuple[float, float, float]:
        """
        Move the cursor forward by `metres` along the route polyline.
        Returns (lat, lng, heading).
        """
        remaining = metres
        while remaining > 0 and self._current_seg < len(self._segment_lengths):
            seg_len = self._segment_lengths[self._current_seg]
            if seg_len < 1e-6:
                self._current_seg += 1
                self._frac_in_seg = 0.0
                continue

            # How far along this segment can we go?
            frac_available = 1.0 - self._frac_in_seg
            metres_in_seg = frac_available * seg_len

            if remaining < metres_in_seg:
                # Stay within current segment
                self._frac_in_seg += remaining / seg_len
                remaining = 0
            else:
                # Move to next segment
                remaining -= metres_in_seg
                self._current_seg += 1
                self._frac_in_seg = 0.0

        # Clamp to last point if we've gone past
        if self._current_seg >= len(self._segment_lengths):
            self._current_seg = len(self._segment_lengths) - 1
            self._frac_in_seg = 1.0

        # Interpolate position
        p1 = self._route_points[self._current_seg]
        p2 = self._route_points[min(self._current_seg + 1, len(self._route_points) - 1)]
        lat, lng = interpolate(p1, p2, self._frac_in_seg)

        # Compute heading
        hdg = heading_deg(p1, p2)

        return lat, lng, hdg

    def _simulate_step(self) -> Tuple[float, float, float, float]:
        """
        Advance along route and return (lat, lng, speed_kmph, heading).
        Speed varies slightly around base_speed with sinusoidal noise.
        """
        # Speed with some realistic variation
        variation = self.base_speed * 0.3
        speed = self.base_speed + variation * math.sin(time.time() / 15)
        speed = max(5.0, min(speed, 60.0))

        # Distance = speed (m/s) × interval
        speed_mps = speed * 1000 / 3600
        metres = speed_mps * self.interval_s

        # Add small GPS noise
        lat, lng, hdg = self._advance_cursor(metres)
        lat += jitter_noise(0.00001)
        lng += jitter_noise(0.00001)

        self._cursor_lat = lat
        self._cursor_lng = lng

        return lat, lng, round(speed, 1), round(hdg, 1)

    # ── send GPS ─────────────────────────────────────────────

    def send_gps(self) -> dict:
        lat, lng, speed, heading = self._simulate_step()
        self._msg_count += 1

        elapsed = time.time() - self._start_time
        remaining = self.duration_s - elapsed
        pct = min(100, (elapsed / self.duration_s) * 100)

        # Progress bar
        bar_len = 30
        filled = int(bar_len * pct / 100)
        bar = "█" * filled + "░" * (bar_len - filled)

        print(
            f"\r  [{bar}] {pct:5.1f}%  "
            f"lat={lat:.6f} lng={lng:.6f}  "
            f"speed={speed} km/h  hdg={heading}°  "
            f"msg#{self._msg_count}  "
            f"seg={self._current_seg}/{len(self._segment_lengths)-1}  "
            f"rem={remaining:.0f}s",
            end="",
            flush=True,
        )

        payload = {
            "vehicle_id": self.vehicle_id,
            "lat": round(lat, 6),
            "lng": round(lng, 6),
            "speed": speed,
            "heading": heading,
        }
        if self.trip_id:
            payload["trip_id"] = self.trip_id

        resp = requests.post(
            f"{self.api_base_url}/api/tracking/driver-location/",
            json=payload,
            headers=self._headers(),
            timeout=10,
        )

        if resp.status_code == 401:
            logger.warning("\nToken expired, re-authenticating ...")
            self.authenticate()
            return self.send_gps()

        if resp.status_code >= 400:
            logger.warning(
                "\nGPS send failed [%s]: %s",
                resp.status_code, resp.text,
            )

        resp.raise_for_status()
        return resp.json()

    # ── main loop ────────────────────────────────────────────

    def run(self) -> None:
        signal.signal(signal.SIGINT, self._handle_signal)
        signal.signal(signal.SIGTERM, self._handle_signal)

        self.authenticate()
        self.fetch_route_geometry()
        self.start_trip()

        self._start_time = time.time()

        print(f"\n{'=' * 70}")
        print(f"  Route-Based GPS Simulator")
        print(f"  Vehicle   : {self.vehicle_id}")
        print(f"  Trip      : {self.trip_id}")
        print(f"  Route     : {self.route_id}")
        print(f"  Direction : {self.direction}")
        print(f"  Duration  : {self.duration_s}s ({self.duration_s // 60}m{self.duration_s % 60}s)")
        print(f"  Interval  : {self.interval_s}s")
        print(f"  Speed     : ~{self.base_speed} km/h")
        print(f"  Route len : {self._total_length_m:.0f}m ({len(self._route_points)} points)")
        print(f"  Start     : ({self._cursor_lat:.6f}, {self._cursor_lng:.6f})")
        print(f"  Endpoint  : POST {self.api_base_url}/api/tracking/driver-location/")
        print(f"{'=' * 70}\n")

        while self._running:
            elapsed = time.time() - self._start_time
            if elapsed >= self.duration_s:
                logger.info("\nDuration reached, stopping ...")
                break

            try:
                self.send_gps()
            except requests.RequestException as e:
                logger.error("\nAPI request failed: %s", e)
            except Exception as e:
                logger.exception("\nUnexpected error: %s", e)

            # Jittered sleep
            jitter = random.uniform(
                self.interval_s * 0.8,
                self.interval_s * 1.2,
            )
            time.sleep(jitter)

        # Cleanup
        self.end_trip()

        total_time = time.time() - self._start_time
        print(f"\n\n{'=' * 70}")
        print(f"  Simulator Finished")
        print(f"  Total time : {total_time:.1f}s")
        print(f"  Messages   : {self._msg_count}")
        print(f"  Final pos  : ({self._cursor_lat:.6f}, {self._cursor_lng:.6f})")
        print(f"  Distance   : {self._total_length_m:.0f}m route")
        print(f"{'=' * 70}\n")

        logger.info("Simulator stopped (published %d messages in %.1fs)", self._msg_count, total_time)

    def _handle_signal(self, signum, frame):
        logger.info("\nReceived signal %s, shutting down ...", signum)
        self._running = False


# ── CLI ──────────────────────────────────────────────────────

def list_routes(api_url: str, token: str) -> None:
    """Fetch and print all routes from the DB."""
    resp = requests.get(
        f"{api_url}/api/transport/routes/",
        headers={"Authorization": f"Bearer {token}", "Content-Type": "application/json"},
        timeout=15,
    )
    resp.raise_for_status()
    data = resp.json()

    routes = data if isinstance(data, list) else data.get("data", data.get("results", []))
    if not routes:
        print("No routes found in the database.")
        return

    print(f"\n{'ID':<40} {'Name':<30} {'Start':<20} {'End':<20}")
    print("-" * 110)
    for r in routes:
        print(
            f"{r['id']:<40} {r.get('name',''):<30} "
            f"{r.get('start_name',''):<20} {r.get('end_name',''):<20}"
        )
    print()


def main():
    parser = argparse.ArgumentParser(
        description="Route-Based GPS Simulator — 10-minute run using real route data"
    )
    parser.add_argument("--api-url", default=os.getenv("API_URL", "http://localhost:8000"))
    parser.add_argument("--email", default=os.getenv("DRIVER_EMAIL", "driver@gmail.com"))
    parser.add_argument("--password", default=os.getenv("DRIVER_PASSWORD", "zxcv9876"))
    parser.add_argument("--vehicle-id", default=os.getenv("VEHICLE_ID"))
    parser.add_argument("--route-id", default=os.getenv("ROUTE_ID"))
    parser.add_argument("--direction", default="outbound", choices=["outbound", "inbound"])
    parser.add_argument("--duration", type=int, default=600, help="Run duration in seconds (default 600 = 10 min)")
    parser.add_argument("--interval", type=float, default=3.0, help="GPS ping interval in seconds")
    parser.add_argument("--speed", type=float, default=25.0, help="Base speed in km/h")
    parser.add_argument("--list-routes", action="store_true", help="List all routes and exit")
    args = parser.parse_args()

    # Quick auth for --list-routes
    if args.list_routes:
        resp = requests.post(
            f"{args.api_url}/api/accounts/login/",
            json={"email": args.email, "password": args.password},
            timeout=15,
        )
        resp.raise_for_status()
        token = resp.json()["data"]["tokens"]["access"]
        list_routes(args.api_url, token)
        return

    if not args.vehicle_id:
        parser.error("--vehicle-id is required (or set VEHICLE_ID env var)")

    if not args.route_id:
        # Try to list routes so user can pick
        print("--route-id not provided. Fetching available routes ...\n")
        try:
            resp = requests.post(
                f"{args.api_url}/api/accounts/login/",
                json={"email": args.email, "password": args.password},
                timeout=15,
            )
            resp.raise_for_status()
            token = resp.json()["data"]["tokens"]["access"]
            list_routes(args.api_url, token)
        except Exception as e:
            logger.error("Could not list routes: %s", e)

        route_id = input("Enter route ID: ").strip()
        if not route_id:
            parser.error("route-id is required")
        args.route_id = route_id

    simulator = RouteGPSSimulator(
        api_base_url=args.api_url,
        email=args.email,
        password=args.password,
        vehicle_id=args.vehicle_id,
        route_id=args.route_id,
        direction=args.direction,
        duration_s=args.duration,
        interval_s=args.interval,
        speed_kmph=args.speed,
    )
    simulator.run()


if __name__ == "__main__":
    main()
