#!/usr/bin/env python3
"""
Dummy Passenger Simulation Script.

Simulates a real passenger flow:
1. Register/Login as passenger
2. Search for routes by location
3. Request dispatch on a route
4. Connect to dispatch WS, wait for acceptance
5. Connect to trip tracking WS, receive location updates
6. Rate the ride

Usage:
    python scripts/simulate_passenger.py [--host HOST] [--email EMAIL] [--password PASSWORD]
"""

import argparse
import asyncio
import json
import os
import random
import sys
import time
import uuid

import httpx
import websockets

API_HOST = "http://localhost:8000"
WS_HOST = "ws://localhost:8000"


class PassengerSimulator:
    def __init__(self, host: str, email: str, password: str):
        self.api_base = host
        self.ws_base = host.replace("http://", "ws://").replace("https://", "wss://")
        self.email = email
        self.password = password
        self.access_token = None
        self.refresh_token = None
        self.user_id = None
        self.route_id = None
        self.pickup_stop_id = None
        self.dispatch_id = None
        self.trip_id = None
        self._ws = None

    def _headers(self):
        if self.access_token:
            return {
                "Authorization": f"Bearer {self.access_token}",
                "Content-Type": "application/json",
            }
        return {"Content-Type": "application/json"}

    def _api_url(self, path: str) -> str:
        return f"{self.api_base}/api{path}"

    def register(self):
        print(f"[PASSENGER] Registering {self.email}...")
        resp = httpx.post(
            self._api_url("/accounts/register/"),
            json={
                "email": self.email,
                "password": self.password,
                "role": "passenger",
                "first_name": "Test",
                "last_name": "Passenger",
            },
            timeout=10,
        )
        data = resp.json()
        if not data.get("success"):
            print(f"[PASSENGER] Register warning: {data.get('message', 'unknown')}")
        else:
            print(f"[PASSENGER] Registered. User ID: {data['data']['user']['id']}")
        return data

    def verify_otp(self):
        print(f"[PASSENGER] Verifying OTP for {self.email}...")
        resp = httpx.post(
            self._api_url("/accounts/verify-otp/"),
            json={"email": self.email, "otp": "000000"},
            timeout=10,
        )
        data = resp.json()
        if data.get("success"):
            print("[PASSENGER] OTP verified.")
        else:
            print(f"[PASSENGER] OTP verify warning: {data.get('message', 'unknown')}")
        return data

    def login(self):
        print(f"[PASSENGER] Logging in {self.email}...")
        resp = httpx.post(
            self._api_url("/accounts/login/"),
            json={"email": self.email, "password": self.password},
            timeout=10,
        )
        data = resp.json()
        if data.get("success"):
            self.access_token = data["data"]["tokens"]["access"]
            self.refresh_token = data["data"]["tokens"]["refresh"]
            self.user_id = str(data["data"]["user"]["id"])
            print(f"[PASSENGER] Logged in. User ID: {self.user_id}")
        else:
            raise RuntimeError(f"Login failed: {data.get('message', 'unknown')}")
        return data

    def search_routes(self, origin_lat=26.8467, origin_lng=80.9462, dest_lat=26.8567, dest_lng=80.9562):
        print(f"[PASSENGER] Searching routes from ({origin_lat},{origin_lng}) to ({dest_lat},{dest_lng})...")
        resp = httpx.get(
            self._api_url("/transport/routes/search-by-location/"),
            headers=self._headers(),
            params={
                "origin_lat": origin_lat,
                "origin_lng": origin_lng,
                "dest_lat": dest_lat,
                "dest_lng": dest_lng,
                "radius": 2000,
            },
            timeout=10,
        )
        data = resp.json()
        results = data.get("data", data) if isinstance(data, dict) else data
        if results:
            route = results[0]
            self.route_id = route["id"]
            self.pickup_stop_id = route["pickup_stop"]["id"]
            print(f"[PASSENGER] Found route: {route.get('name', 'unknown')} (ID: {self.route_id})")
            print(f"[PASSENGER] Pickup stop: {route['pickup_stop']['name']} (ID: {self.pickup_stop_id})")
        else:
            print("[PASSENGER] No routes found. Using mock IDs.")
            self.route_id = str(uuid.uuid4())
            self.pickup_stop_id = str(uuid.uuid4())
        return results

    def request_dispatch(self):
        print("[PASSENGER] Requesting dispatch...")
        resp = httpx.post(
            self._api_url("/operations/dispatch/request/"),
            headers=self._headers(),
            json={
                "route_id": self.route_id,
                "pickup_stop_id": self.pickup_stop_id,
                "mode": "direct",
            },
            timeout=10,
        )
        data = resp.json()
        if resp.status_code in (200, 201, 202):
            self.dispatch_id = data.get("trip_id") or data.get("data", {}).get("trip_id")
            print(f"[PASSENGER] Dispatch requested. Dispatch ID: {self.dispatch_id}")
        else:
            print(f"[PASSENGER] Dispatch request failed: {data}")
            return None
        return data

    async def listen_dispatch_ws(self, timeout=30):
        if not self.dispatch_id:
            print("[PASSENGER] No dispatch ID to listen on.")
            return None

        ws_url = f"{self.ws_base}/ws/dispatch/{self.dispatch_id}/"
        print(f"[PASSENGER] Connecting to dispatch WS: {ws_url}")

        try:
            async with websockets.connect(ws_url) as ws:
                while True:
                    try:
                        msg = await asyncio.wait_for(ws.recv(), timeout=timeout)
                        data = json.loads(msg)
                        print(f"[PASSENGER] WS dispatch event: {data.get('type', data)}")
                        if data.get("type") in ("dispatch_accepted", "dispatch_update"):
                            status = data.get("data", {}).get("status", data.get("status"))
                            if status in ("accepted", "arrived", "active", "completed"):
                                return data
                    except asyncio.TimeoutError:
                        print("[PASSENGER] WS timeout - no dispatch update received.")
                        return None
        except Exception as e:
            print(f"[PASSENGER] WS error: {e}")
            return None

    async def listen_trip_tracking_ws(self, timeout=60):
        trip_id = self.trip_id or self.dispatch_id
        if not trip_id:
            print("[PASSENGER] No trip ID to track.")
            return

        ws_url = f"{self.ws_base}/ws/tracking/trip/{trip_id}/"
        print(f"[PASSENGER] Connecting to trip tracking WS: {ws_url}")

        try:
            async with websockets.connect(
                ws_url,
                extra_headers={"Authorization": f"Bearer {self.access_token}"}
                if self.access_token
                else {},
            ) as ws:
                start = time.time()
                while time.time() - start < timeout:
                    try:
                        msg = await asyncio.wait_for(ws.recv(), timeout=5)
                        data = json.loads(msg)
                        print(f"[PASSENGER] Trip update: {json.dumps(data, indent=2)[:200]}")
                        if data.get("type") == "vehicle_update":
                            lat = data.get("data", {}).get("lat")
                            lng = data.get("data", {}).get("lng") or data.get("data", {}).get("lon")
                            print(f"[PASSENGER] Vehicle at: {lat}, {lng}")
                    except asyncio.TimeoutError:
                        continue
        except Exception as e:
            print(f"[PASSENGER] Trip tracking WS error: {e}")

    def submit_rating(self, rating=5, review="Great ride!"):
        print(f"[PASSENGER] Submitting rating: {rating}/5...")
        resp = httpx.post(
            self._api_url("/ride/rating/"),
            headers=self._headers(),
            json={
                "dispatch_id": self.dispatch_id,
                "rating": rating,
                "review": review,
            },
            timeout=10,
        )
        data = resp.json()
        print(f"[PASSENGER] Rating response: {data.get('message', 'submitted')}")
        return data

    def get_ride_history(self):
        print("[PASSENGER] Fetching ride history...")
        resp = httpx.get(
            self._api_url("/ride/history/"),
            headers=self._headers(),
            timeout=10,
        )
        data = resp.json()
        count = len(data.get("data", data)) if isinstance(data, dict) else len(data)
        print(f"[PASSENGER] Ride history: {count} trips")
        return data

    async def run_full_flow(self, origin_lat, origin_lng, dest_lat, dest_lng):
        self.register()
        self.verify_otp()
        self.login()

        routes = self.search_routes(origin_lat, origin_lng, dest_lat, dest_lng)
        if routes:
            dispatch = self.request_dispatch()
            if dispatch:
                print("[PASSENGER] Waiting for driver to accept (listening on dispatch WS)...")
                await self.listen_dispatch_ws(timeout=45)

                print("[PASSENGER] Listening for live tracking updates...")
                await self.listen_trip_tracking_ws(timeout=30)

        self.submit_rating()
        self.get_ride_history()
        print("[PASSENGER] Flow complete.")


def main():
    parser = argparse.ArgumentParser(description="Simulate a passenger ride flow")
    parser.add_argument("--host", default=os.getenv("API_HOST", "http://localhost:8000"))
    parser.add_argument("--email", default=f"passenger_{random.randint(1000,9999)}@test.com")
    parser.add_argument("--password", default="testpass123")
    parser.add_argument("--origin-lat", type=float, default=26.8467)
    parser.add_argument("--origin-lng", type=float, default=80.9462)
    parser.add_argument("--dest-lat", type=float, default=26.8567)
    parser.add_argument("--dest-lng", type=float, default=80.9562)
    args = parser.parse_args()

    sim = PassengerSimulator(args.host, args.email, args.password)
    asyncio.run(sim.run_full_flow(args.origin_lat, args.origin_lng, args.dest_lat, args.dest_lng))


if __name__ == "__main__":
    main()
