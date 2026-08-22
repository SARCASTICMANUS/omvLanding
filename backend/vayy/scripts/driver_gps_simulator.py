#!/usr/bin/env python3
"""
Driver-side GPS Simulator.

Continuously sends GPS location updates to the Vayy tracking API
every 3–5 seconds. The backend processes them and stores them in
Redis (geo-indexed) for real-time nearby vehicle lookups.
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

import requests

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
)
logger = logging.getLogger("driver_gps")


class DriverGPSSimulator:
    def __init__(
        self,
        api_base_url: str,
        email: str,
        password: str,
        vehicle_id: str,
        trip_id: str | None = None,
        interval: float = 3.0,
        route: list[tuple[float, float]] | None = None,
    ):
        self.api_base_url = api_base_url.rstrip("/")
        self.email = email
        self.password = password
        self.vehicle_id = vehicle_id
        self.trip_id = trip_id
        self.interval = interval
        self.route = route or [
            (12.9716, 77.5946),
            (12.9352, 77.6245),
            (12.9250, 77.5938),
            (12.9344, 77.6101),
        ]
        self.access_token: str | None = None
        self._running = True
        self._route_index = 0
        self._current_lat, self._current_lng = self.route[0]

    def authenticate(self) -> None:
        logger.info("Authenticating driver %s ...", self.email)
        resp = requests.post(
            f"{self.api_base_url}/api/accounts/login/",
            json={"email": self.email, "password": self.password},
            timeout=15,
        )
        resp.raise_for_status()
        data = resp.json()
        self.access_token = data["data"]["tokens"]["access"]
        logger.info("Authentication successful")

    def _headers(self) -> dict:
        return {
            "Authorization": f"Bearer {self.access_token}",
            "Content-Type": "application/json",
        }

    def _simulate_step(self) -> tuple[float, float, float, float]:
        target_lat, target_lng = self.route[self._route_index]
        dlat = target_lat - self._current_lat
        dlng = target_lng - self._current_lng
        dist = math.sqrt(dlat ** 2 + dlng ** 2)

        if dist < 0.0005:
            self._route_index = (self._route_index + 1) % len(self.route)
            return self._simulate_step()

        speed_kmph = round(20 + 10 * math.sin(time.time() / 10), 1)
        step_size = 0.0001 * (speed_kmph / 30)

        self._current_lat += (dlat / dist) * step_size + random_offset(0.00002)
        self._current_lng += (dlng / dist) * step_size + random_offset(0.00002)

        heading = math.degrees(math.atan2(dlng, dlat)) % 360
        return self._current_lat, self._current_lng, speed_kmph, round(heading, 1)

    def send_gps(self) -> dict:
        lat, lng, speed, heading = self._simulate_step()
        payload = {
            "vehicle_id": self.vehicle_id,
            "lat": round(lat, 6),
            "lng": round(lng, 6),
            "speed": speed,
            "heading": heading,
        }
        if self.trip_id:
            payload["trip_id"] = self.trip_id

        # Print driver location clearly
        print(
            f"\n[DRIVER LOCATION] vehicle={self.vehicle_id} "
            f"| lat={round(lat, 6)} | lng={round(lng, 6)} "
            f"| speed={speed} km/h | heading={heading}°"
        )

        logger.info(
            "Sending GPS | lat=%.6f lng=%.6f speed=%.1f heading=%.1f",
            lat, lng, speed, heading,
        )

        resp = requests.post(
            f"{self.api_base_url}/api/tracking/gps/",
            json=payload,
            headers=self._headers(),
            timeout=10,
        )

        if resp.status_code == 401:
            logger.warning("Token expired, re-authenticating ...")
            self.authenticate()
            return self.send_gps()

        resp.raise_for_status()

        return resp.json()

    def run(self) -> None:
        signal.signal(signal.SIGINT, self._handle_signal)
        signal.signal(signal.SIGTERM, self._handle_signal)

        self.authenticate()

        print(f"\n{'='*60}")
        print(f"  GPS Simulator Started")
        print(f"  Vehicle ID : {self.vehicle_id}")
        print(f"  Trip ID    : {self.trip_id or 'None'}")
        print(f"  Interval   : {self.interval}s (jittered 3–5s)")
        print(f"  Route      : {len(self.route)} waypoints")
        print(f"  Start pos  : lat={self._current_lat} | lng={self._current_lng}")
        print(f"{'='*60}\n")

        logger.info(
            "Starting GPS loop for vehicle %s every ~%.1fs",
            self.vehicle_id, self.interval,
        )

        while self._running:
            try:
                self.send_gps()
            except requests.RequestException as e:
                logger.error("API request failed: %s", e)
            except Exception as e:
                logger.exception("Unexpected error: %s", e)

            # Jitter between 3–5 seconds
            jitter = random.uniform(3, 5)
            time.sleep(jitter)

        logger.info("Simulator stopped")

    def _handle_signal(self, signum, frame):
        logger.info("Received signal %s, shutting down ...", signum)
        self._running = False


def random_offset(max_val: float) -> float:
    return random.uniform(-max_val, max_val)


def main():
    parser = argparse.ArgumentParser(description="Driver GPS Simulator")
    parser.add_argument("--api-url", default=os.getenv("API_URL", "http://localhost:8000"))
    parser.add_argument("--email", default=os.getenv("DRIVER_EMAIL", "driver@gmail.com"))
    parser.add_argument("--password", default=os.getenv("DRIVER_PASSWORD", "zxcv9876"))
    parser.add_argument("--vehicle-id", default=os.getenv("VEHICLE_ID"), required=not os.getenv("VEHICLE_ID"))
    parser.add_argument("--trip-id", default=os.getenv("TRIP_ID"))
    parser.add_argument("--interval", type=float, default=float(os.getenv("GPS_INTERVAL", "3")))
    args = parser.parse_args()

    simulator = DriverGPSSimulator(
        api_base_url=args.api_url,
        email=args.email,
        password=args.password,
        vehicle_id=args.vehicle_id,
        trip_id=args.trip_id,
        interval=args.interval,
    )
    simulator.run()


if __name__ == "__main__":
    main()


# python3 scripts/driver_gps_simulator.py \
#   --api-url http://localhost:8000 \
#   --email driver@gmail.com \
#   --password Test@1234 \
#   --vehicle-id f3879f39-29d1-4dd3-a876-00c73c468702 \
#   --trip-id 46aefc8f-7c4a-4053-818b-9065651df35c