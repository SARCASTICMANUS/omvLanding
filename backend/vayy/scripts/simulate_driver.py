#!/usr/bin/env python3
"""
Dummy Driver Simulation Script.

Simulates a real driver flow:
1. Register/Login as a driver (bikedriver or autodriver)
2. Connect to notification WS, wait for dispatch request
3. Accept dispatch
4. Connect to vehicle tracking WS, send periodic location updates
5. Arrive at pickup, start trip, complete trip

Usage:
    python scripts/simulate_driver.py [--host HOST] [--role bikedriver|autodriver]
                                     [--email EMAIL] [--password PASSWORD]
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


class DriverSimulator:
    def __init__(self, host: str, email: str, password: str, role: str):
        self.api_base = host
        self.ws_base = host.replace("http://", "ws://").replace("https://", "wss://")
        self.email = email
        self.password = password
        self.role = role  # "bikedriver" or "autodriver"
        self.access_token = None
        self.refresh_token = None
        self.user_id = None
        self.dispatch_id = None
        self.trip_id = None
        self.vehicle_id = None
        self.driver_profile_id = None
        self._running = True

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
        print(f"[DRIVER] Registering {self.email} as {self.role}...")
        resp = httpx.post(
            self._api_url("/accounts/register/"),
            json={
                "email": self.email,
                "password": self.password,
                "role": self.role,
                "first_name": "Test",
                "last_name": "Driver",
            },
            timeout=10,
        )
        data = resp.json()
        if not data.get("success"):
            print(f"[DRIVER] Register warning: {data.get('message', 'unknown')}")
        else:
            uid = data["data"]["user"]["id"]
            print(f"[DRIVER] Registered. User ID: {uid}")
        return data

    def verify_otp(self):
        print(f"[DRIVER] Verifying OTP for {self.email}...")
        resp = httpx.post(
            self._api_url("/accounts/verify-otp/"),
            json={"email": self.email, "otp": "000000"},
            timeout=10,
        )
        data = resp.json()
        if data.get("success"):
            print("[DRIVER] OTP verified.")
        else:
            print(f"[DRIVER] OTP verify warning: {data.get('message', 'unknown')}")
        return data

    def login(self):
        print(f"[DRIVER] Logging in {self.email}...")
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
            print(f"[DRIVER] Logged in. User ID: {self.user_id}")
        else:
            raise RuntimeError(f"Login failed: {data.get('message', 'unknown')}")
        return data

    def get_or_create_driver_profile(self):
        print("[DRIVER] Fetching/creating driver profile...")
        resp = httpx.get(
            self._api_url("/accounts/me/driver-profile/"),
            headers=self._headers(),
            timeout=10,
        )
        data = resp.json()
        if isinstance(data, dict) and "id" in data:
            self.driver_profile_id = str(data["id"])
            profile_data = data
        elif isinstance(data, dict) and data.get("data"):
            self.driver_profile_id = str(data["data"].get("id", ""))
            profile_data = data["data"]
        else:
            profile_data = data
        print(f"[DRIVER] Driver profile ID: {self.driver_profile_id or 'created'}")
        return profile_data

    def get_or_create_vehicle(self):
        print(f"[DRIVER] Fetching/creating vehicle for {self.role}...")
        resp = httpx.get(
            self._api_url("/operations/vehicles/me/"),
            headers=self._headers(),
            timeout=10,
        )
        if resp.status_code == 200:
            data = resp.json()
            vehicle_list = data if isinstance(data, list) else data.get("data", data) if isinstance(data, dict) else [data]
            if isinstance(vehicle_list, list) and vehicle_list:
                v = vehicle_list[0]
                self.vehicle_id = str(v["id"]) if isinstance(v, dict) else str(v)
                print(f"[DRIVER] Found vehicle ID: {self.vehicle_id}")
                return v

        print("[DRIVER] Creating mock vehicle...")
        vehicle_type = "bike" if self.role == "bikedriver" else "auto"
        create_resp = httpx.post(
            self._api_url("/operations/vehicles/"),
            headers=self._headers(),
            json={
                "vehicle_type": vehicle_type,
                "vehicle_number": f"UP32{random.randint(1000,9999)}",
                "capacity": 1 if vehicle_type == "bike" else 3,
            },
            timeout=10,
        )
        if create_resp.status_code in (200, 201):
            v = create_resp.json()
            self.vehicle_id = str(v.get("id", ""))
        else:
            self.vehicle_id = str(uuid.uuid4())
        print(f"[DRIVER] Vehicle ID: {self.vehicle_id}")
        return {"id": self.vehicle_id}

    async def listen_notifications(self, timeout=60):
        ws_url = f"{self.ws_base}/ws/notifications/{self.user_id}/"
        print(f"[DRIVER] Connecting to notification WS: {ws_url}")

        try:
            async with websockets.connect(ws_url) as ws:
                start = time.time()
                while self._running and time.time() - start < timeout:
                    try:
                        msg = await asyncio.wait_for(ws.recv(), timeout=5)
                        data = json.loads(msg)
                        print(f"[DRIVER] Notification received: {data.get('type')}")
                        event_data = data.get("data", data)

                        if data.get("type") == "new_dispatch_request":
                            self.dispatch_id = event_data.get("dispatch_id") or event_data.get("trip_id")
                            print(f"[DRIVER] New dispatch request! Dispatch ID: {self.dispatch_id}")
                            return data
                    except asyncio.TimeoutError:
                        continue
        except Exception as e:
            print(f"[DRIVER] Notification WS error: {e}")
        return None

    def accept_dispatch(self):
        if not self.dispatch_id:
            print("[DRIVER] No dispatch to accept.")
            return None
        print(f"[DRIVER] Accepting dispatch {self.dispatch_id}...")
        resp = httpx.patch(
            self._api_url(f"/operations/dispatch/{self.dispatch_id}/accept/"),
            headers=self._headers(),
            timeout=10,
        )
        data = resp.json()
        self.trip_id = self.dispatch_id
        print(f"[DRIVER] Dispatch accepted. Trip ID: {self.trip_id}")
        return data

    def arrived_at_pickup(self):
        if not self.dispatch_id:
            return None
        print("[DRIVER] Marking arrived at pickup...")
        resp = httpx.patch(
            self._api_url(f"/operations/dispatch/{self.dispatch_id}/arrived/"),
            headers=self._headers(),
            timeout=10,
        )
        data = resp.json()
        print(f"[DRIVER] Arrived: {data.get('message', 'ok')}")
        return data

    def start_trip(self):
        if not self.dispatch_id:
            return None
        print("[DRIVER] Starting trip...")
        resp = httpx.patch(
            self._api_url(f"/operations/dispatch/{self.dispatch_id}/start/"),
            headers=self._headers(),
            timeout=10,
        )
        data = resp.json()
        print(f"[DRIVER] Trip started: {data.get('message', 'ok')}")
        return data

    def complete_trip(self):
        if not self.dispatch_id:
            return None
        print("[DRIVER] Completing trip...")
        resp = httpx.patch(
            self._api_url(f"/operations/dispatch/{self.dispatch_id}/complete/"),
            headers=self._headers(),
            timeout=10,
        )
        data = resp.json()
        print(f"[DRIVER] Trip completed: {data.get('message', 'ok')}")
        return data

    async def send_location_updates(self, interval=3, count=10):
        if not self.vehicle_id:
            print("[DRIVER] No vehicle ID for location updates.")
            return

        ws_url = f"{self.ws_base}/ws/tracking/vehicle/{self.vehicle_id}/"
        print(f"[DRIVER] Connecting to vehicle tracking WS: {ws_url}")

        lat, lng = 26.8467, 80.9462
        try:
            async with websockets.connect(
                ws_url,
                extra_headers={"Authorization": f"Bearer {self.access_token}"}
                if self.access_token
                else {},
            ) as ws:
                for i in range(count):
                    if not self._running:
                        break
                    lat += random.uniform(-0.001, 0.001)
                    lng += random.uniform(-0.001, 0.001)
                    payload = {
                        "type": "location_update",
                        "lat": round(lat, 6),
                        "lon": round(lng, 6),
                        "speed": round(random.uniform(10, 40), 1),
                        "heading": random.randint(0, 360),
                        "trip_id": self.trip_id,
                    }
                    await ws.send(json.dumps(payload))
                    print(f"[DRIVER] Sent location {i+1}/{count}: ({payload['lat']}, {payload['lon']})")
                    await asyncio.sleep(interval)
        except Exception as e:
            print(f"[DRIVER] Tracking WS error: {e}")

    async def run_full_flow(self):
        self.register()
        self.verify_otp()
        self.login()
        self.get_or_create_driver_profile()
        self.get_or_create_vehicle()

        print("\n[DRIVER] Waiting for dispatch request via notification WS...")
        notification = await self.listen_notifications(timeout=60)

        if notification:
            self.accept_dispatch()
            await asyncio.sleep(2)

            self.arrived_at_pickup()
            await asyncio.sleep(2)

            print("[DRIVER] Sending location updates while en-route...")
            await self.send_location_updates(interval=2, count=5)

            self.start_trip()
            await asyncio.sleep(2)

            print("[DRIVER] Sending more location updates during trip...")
            await self.send_location_updates(interval=2, count=5)

            self.complete_trip()
        else:
            print("[DRIVER] No dispatch request received within timeout.")

        print("[DRIVER] Flow complete.")


def main():
    parser = argparse.ArgumentParser(description="Simulate a driver ride flow")
    parser.add_argument("--host", default=os.getenv("API_HOST", "http://localhost:8000"))
    parser.add_argument("--role", default="bikedriver", choices=["bikedriver", "autodriver"])
    parser.add_argument("--email", default=f"driver_{random.randint(1000,9999)}@test.com")
    parser.add_argument("--password", default="testpass123")
    args = parser.parse_args()

    sim = DriverSimulator(args.host, args.email, args.password, args.role)
    asyncio.run(sim.run_full_flow())


if __name__ == "__main__":
    main()
