# VAYY | Project Mandates & Documentation

This document serves as the primary technical reference for VAYY, a real-time public transit tracking and manifest management system.

## 🏗 Architectural Mandates

1.  **Transient State:** All real-time or high-frequency transient state (GPS positions, manifest snapshots, active trip counts) **MUST** live in Redis. Do not write high-frequency updates directly to PostgreSQL.
2.  **Geospatial Logic:** 
    - Use `PostGIS` for persistent spatial queries (e.g., "Find routes near point").
    - Use `Redis GEO` for real-time spatial queries (e.g., "Find buses near passenger").
    - Use `OSRM` for all ETA and distance calculations. Never use straight-line distance for ETAs.
3.  **Real-Time Communication:**
    - Use **Delta Updates** for WebSocket broadcasts. Only send essential changed fields in high-frequency frames (e.g., `v_delta` payload).
    - Specialized groups: `city_{id}` for city-wide monitoring, `trip_{id}` for specific vehicle tracking, `user_{id}` for personal alerts, `manifest_{vehicle_id}` for driver manifest updates.
4.  **Consistency:** Use `process_gps_update` in `core/utils.py` as the single source of truth for handling location ingestion, whether from WebSockets or Hybrid sources.

## 🛠 System Overview

### Backend (Django + Channels)
- **API Framework:** Django Rest Framework (DRF) with SimpleJWT authentication.
- **Real-Time Engine:** Django Channels (Daphne) managing WebSocket connections.
- **Task Queue:** Celery with Redis broker for background processing.
- **Database:** PostgreSQL with PostGIS extension for spatial data.

### Frontend (React + Redux)
- **State Management:** Redux Toolkit (RTK) with RTK Query for API calls and slices for live tracking state.
- **Socket Management:** Centralized `SocketManager` for handling multiple WebSocket connections with auto-reconnect logic.
- **Styling:** TailwindCSS used for layout and UI components.

## 📡 Real-Time Data Flow

### 1. Location Ingestion
- **Source A (WebSocket):** Drivers send `(lat, lon)` via `VayyConsumer`.
- **Source B (Hybrid):** Raw signals (Wi-Fi/Cell) are streamed to Redis, resolved via Mozilla Location Service (MLS) in Celery, and smoothed using a **Kalman Filter**.
- **Processing:** Both sources trigger `process_gps_update`, which:
    - Updates Redis `GEO` sets and temporary coordinate strings.
    - Calculates schedule delay by comparing current location with `StopTime` schedules.
    - Detects stop arrivals (within 50m for 15s).
    - Broadcasts delta updates to WebSocket groups.

### 2. Broadcast Strategy
- **City Group (`city_{id}`):** Receives `v_delta` updates for all active vehicles in the city. Used by city admins and passenger "nearby" views.
- **Trip Group (`trip_{id}`):** Receives detailed updates for a specific trip, including next-stop ETAs calculated via OSRM.
- **Manifest Group (`manifest_{vehicle_id}`):** Dedicated channel for drivers to receive passenger boarding updates and stop-by-stop manifest changes.

## 🗺 Geospatial & Routing Logic

### OSRM Integration
- **Routing:** All route geometries are generated via OSRM's `/route` API.
- **ETA/Distance Matrix:** Used for calculating accurate "Next Stop" durations and passenger-to-bus proximity metrics.
- **Caching:** OSRM results are cached (Redis/Django Cache) for 10-30 seconds to minimize overhead.

### Proximity Alerts
- **Arrival Detection:** If a vehicle stays within 50m of a `Stop` for >15 seconds, it is marked as "arrived" at that stop.
- **Passenger Alerts:** Automated "Bus is 500m away" notifications sent to passengers with pending `BoardingRequests` for that trip.

## 🗄 Core Data Models

### Persistent (PostgreSQL)
- **User:** Custom model with roles (`passenger`, `driver`, `city_admin`, `admin`).
- **City:** Geographic boundary for routes and services.
- **Route / Stop:** Static route definitions and ordered stop sequences.
- **TripSchedule / StopTime:** Planned arrival times for specific "slots" or shifts.
- **ActiveTrip:** Links a `Vehicle`, `Driver`, and `Route` into a live session.
- **PublicPassengerProfile / PublicDriverProfile:** Role-specific metadata and history.
- **BoardingRequest:** Tracks passenger intent to board a specific trip at a specific stop.

### Transient (Redis)
- `active_trips_locations`: Geo-indexed positions of all live vehicles.
- `passenger_locations`: Geo-indexed positions of active passengers.
- `driver_pos:{trip_id}`: Most recent coordinate string for fast lookup.
- `kf_state:{trip_id}`: Last known state of the Kalman Filter (velocity, heading).
- `manifest:{trip_id}`: Aggregated manifest snapshot for driver views.

## 🚀 Key Workflows

### Driver Trip Lifecycle
1. **Start Trip:** Driver selects a `TripSchedule`. `ActiveTrip` is created/activated.
2. **Movement:** Live positions sent via WS. `process_gps_update` handles all logic.
3. **Manifest:** Driver sees real-time hand-raises and boarding requests.
4. **End Trip:** `ActiveTrip` marked inactive. Redis keys cleaned up.

### Passenger Journey
1. **Discovery:** Find nearby routes or buses via `city_{id}` broadcast.
2. **Request:** Create a `BoardingRequest` for a specific stop.
3. **Tracking:** Watch the bus approach with OSRM-backed ETAs.
4. **Boarding:** Receive proximity alerts and board the vehicle.

## 📁 Repository Structure
- `backend/core/services/`: Modular business logic (Manifests, Geocoding, Routing).
- `backend/core/api/`: DRF Serializers and ViewSets.
- `backend/core/consumers.py`: WebSocket protocol implementations.
- `frontend/src/features/`: Redux-driven feature modules (Auth, Trip, Tracking).
- `frontend/src/services/sockets/`: Core WebSocket infrastructure.

---
*Last Updated: Friday, May 22, 2026*
