# 🚖 Vayy - Public Transit & Real-Time Tracking Platform

**Vayy** is a production-grade, real-time geospatial platform designed for urban public transport and institutional bus tracking. Built to handle high concurrency, Vayy connects passengers with fixed-route buses, vans, and shuttles through a resilient, low-latency architecture.

The platform has recently transitioned to a flexible **City/Passenger/Driver** model, supporting multi-city deployments and diverse vehicle types (Bus, Van, Auto-Rickshaw, etc.).

---

## 🏗 System Architecture

The project is built to handle high concurrency by offloading geospatial calculations to **OSRM**, real-time state to **Redis**, and heavy tasks to **Celery**.

| Service         | Technology              | Purpose                                           |
| :-------------- | :---------------------- | :------------------------------------------------ |
| **Frontend**    | React 19 + Vite + Tailwind | Modern SPA with MapLibre GL & Redux Toolkit.      |
| **Backend**     | Django 4.2 + GeoDjango  | REST API, Auth, Database Management.              |
| **WebSockets**  | Daphne (ASGI)           | Bi-directional live GPS & ETA broadcasting.       |
| **Database**    | PostgreSQL + PostGIS    | Persistent storage for Routes & Spatial Indexing. |
| **Cache/PubSub**| Redis 7                 | Real-time GPS storage (GEO) & Celery queues.      |
| **Workers**     | Celery                  | Async tasks (Location Sync, Stale Cleanup).       |
| **Routing**     | OSRM (C++ Engine)       | High-speed routing engine for ETA & Distances.    |
| **Proxy**       | Nginx                   | Unified entry point and request routing.          |

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
