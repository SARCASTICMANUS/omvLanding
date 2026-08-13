# 🚖 Vayy - Public Transit & Real-Time Tracking Platform

**Vayy** is a production-grade, real-time geospatial platform designed for urban public transport and institutional bus tracking. Built to handle high concurrency, Vayy connects passengers with fixed-route buses, vans, and shuttles through a resilient, low-latency architecture.

The platform has recently transitioned to a flexible **City/Passenger/Driver** model, supporting multi-city deployments and diverse vehicle types (Bus, Van, Auto-Rickshaw, etc.).

---

## 🏗 System Architecture & High Level Design

Vayy is architected for low-latency geospatial tracking and high concurrency. The system is divided into three primary layers:

### 1. Ingestion & Real-Time State (Hot Layer)
- **WebSockets (Daphne):** Drivers stream GPS coordinates every 1-3 seconds. Passengers stream location and 'hand-raise' status.
- **Redis GEO:** High-frequency positions are stored in Redis GEO sets for sub-millisecond proximity queries.
- **Delta Updates:** To minimize bandwidth, the server broadcasts 'delta' payloads (only changed fields like coordinates, heading, and delay) to subscribed clients.

### 2. Processing & Logic (Logic Layer)
- **Kalman Filtering:** All raw GPS data passes through a Kalman Filter to smooth out noise and provide fluid vehicle movement on the map.
- **Schedule Adherence:** The system automatically calculates delays by comparing the vehicle's current position to the scheduled arrival times at the nearest stop.
- **Automated Geofencing:** 
    - **Arrival Detection:** Detects when a bus is within 50m of a stop for >15 seconds.
    - **Proximity Alerts:** Automatically notifies passengers when their bus is within 500m of their pickup point.
- **Hybrid Resolution:** Non-GPS location data (Cell/Wi-Fi) is resolved via Mozilla Location Service (MLS) through a Redis-backed async pipeline.

### 3. Persistence & Analytics (Cold Layer)
- **PostgreSQL + PostGIS:** Long-term storage for routes, stops, and user profiles. 
- **Celery Sync:** High-frequency location data is batched and synced from Redis to PostgreSQL every 60 seconds to optimize DB performance.

---

## 🛠 Real-Time Data Flow

1.  **Driver Update:** `GPS Update -> WebSocket -> process_gps_update()`
2.  **Processing:** 
    - Update Redis State (GEO & String)
    - Calculate Schedule Delay
    - Detect Stop Arrival / Geofence Breach
3.  **Broadcast:** 
    - `Trip Group:` Individual tracking info.
    - `City Group:` Delta updates for all vehicles in the city.
    - `User Group:` Specific proximity alerts for passengers.

---

## 🚀 Key Features

### **🗺️ Real-Time Geospatial & Tracking**
- **Live Tracking:** Sub-second GPS updates via WebSockets for both drivers and passengers.
- **Directional Filtering:** Smart "Filtered Trips" logic ensuring passengers only see buses moving *towards* them.
- **Hybrid Ingestion:** Supports GPS and Cell Tower/Wi-Fi signals for robust tracking.
- **Smoothing:** Kalman Filter implementation for fluid, noise-reduced vehicle positioning.
- **Schedule Adherence:** Automatic delay calculation (Actual vs. Scheduled) shown in real-time.
- **Geofencing & Alerts:** Automated proximity notifications when a bus approaches a pickup stop.

### **🎫 Boarding & Manifest Management**
- **Digital Manifest:** Real-time boarding control interface for drivers via dedicated WebSocket manifests.
- **Booking System:** Passenger-driven stop booking (Pending -> Approaching -> Boarded -> Completed).
- **Automated Stop Detection:** Geofencing logic to auto-detect arrivals at stops based on dwell time.

### **🛠️ Admin Panel**
- **Route Creator:** Map interface to design complex routes with ordered stops.
- **Multi-City Management:** Support for multiple cities, each with isolated routes, users, and vehicles.
- **Granular Roles:** `Admin`, `City Admin`, `Driver`, and `Passenger`.

### **📱 Driver & Passenger Experience**
- **One-Tap Trip:** Drivers can easily start/resume trips with route-specific stop lists.
- **OTP Onboarding:** Secure 6-digit OTP flow for registration and password resets.
- **High-Performance Map:** Smooth, low-bandwidth Delta Updates for live vehicle motion.
- **Walking ETAs:** OSRM-powered walking ETAs for passengers to reach stops on time.

---

## 📁 Project Structure

```text
vayy/
├── backend/                # Django/GeoDjango Project
│   ├── core/               # Main application logic (Models, Views, Consumers)
│   │   ├── api/            # DRF Serializers & ViewSets
│   │   ├── services/       # Business Logic (ManifestManager)
│   │   ├── tasks.py        # Celery background tasks (Geofencing, Manifests)
│   │   ├── consumers.py    # WebSocket logic (Daphne/Channels)
│   │   └── utils.py        # Kalman Filter, OSRM & Geospatial helpers
├── frontend/               # React Vite SPA
│   ├── src/
│   │   ├── components/     # UI & Map Components (DriverManifest, MapLibre)
│   │   └── pages/          # Admin, Dashboard, Auth pages
└── docker-compose.yaml     # Infrastructure & Service Orchestration
```

---

## 🐳 Docker Deployment Setup (Recommended)

### 1. Map Data Preparation
Place your `.osm.pbf` file (e.g., from [Geofabrik](https://download.geofabrik.de/)) in `backend/osrm-data/` and rename it to `map.osm.pbf`.

```bash
mkdir -p backend/osrm-data
# Move your downloaded file there:
mv india-latest.osm.pbf backend/osrm-data/map.osm.pbf
```

### 2. Launch Services
```bash
docker-compose up -d --build
```

**Unified Entry Point:** [http://localhost](http://localhost) (via Nginx)

---

## 🛠 Local Development

### Prerequisites
- Python 3.10+ & Node.js 20+
- **PostgreSQL 15+** with **PostGIS** extension
- **Redis 7**

### Backend Setup
```bash
cd backend
python -m venv venv && source venv/bin/activate
pip install -r requirements.txt
python manage.py migrate
# Start core services:
python manage.py runserver  # API Development
daphne -p 8001 vayy.asgi:application # WebSockets
celery -A vayy worker -l info # Async Tasks
```

### Frontend Setup
```bash
cd frontend
npm install
npm run dev
```

---

## 📈 Scalability & Production Readiness

Vayy is architected for regional and institutional scales (up to 10k concurrent users). For PAN India deployment (1M+ users), the platform has a clear roadmap involving:
- **Hot Geospatial Store:** Shifting real-time positions from PostgreSQL to **Tile38** or **Redis Cluster**.
- **Microservices:** Decoupling coordinate ingestion using **Go** or **Node.js** for high-performance I/O.
- **Protobuf:** Utilizing Protocol Buffers for WebSocket messages to reduce bandwidth by ~60%.

*See [scalability_report.md](scalability_report.md) for the full technical audit.*

---

## 📜 Troubleshooting

- **PostGIS Compatibility**: The `docker-compose.yaml` uses `platform: linux/amd64` for the `db` container to ensure stability on Apple Silicon.
- **OSRM Unreachable**: Ensure the `OSRM_URL` environment variable points to the correct endpoint (Default: `http://osrm:5000`).
- **WebSocket Connection**: If connecting via Nginx, ensure the `/ws/` block is correctly configured for `Upgrade` headers.
