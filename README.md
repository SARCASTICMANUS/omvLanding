# 🚖 Vayy - Public Transit & Real-Time Tracking Platform

**Vayy** is a production-grade, real-time geospatial platform designed for urban public transport and institutional bus tracking. Built to handle high concurrency, Vayy connects passengers with fixed-route buses, vans, and shuttles through a resilient, low-latency architecture.

The platform recently underwent a major refactor from a university-specific model to a flexible **City/Passenger/Driver** public transport model, supporting multi-city deployments and diverse vehicle types.

---

## 🏗 System Architecture

The project is built to handle high concurrency by offloading geospatial calculations to **OSRM**, real-time state to **Redis**, and heavy tasks to **Celery**.

| Service         | Technology              | Purpose                                           |
| :-------------- | :---------------------- | :------------------------------------------------ |
| **Frontend**    | React 19 + Vite + Tailwind | Modern SPA with Leaflet Maps & Redux Toolkit.     |
| **Backend**     | Django 4.2 + GeoDjango  | REST API, Auth, Database Management.              |
| **WebSockets**  | Daphne (ASGI)           | Bi-directional live GPS & ETA broadcasting.       |
| **Database**    | PostgreSQL + PostGIS    | Persistent storage for Routes & Spatial Indexing. |
| **Cache/PubSub**| Redis                   | Real-time GPS storage (GEO) & Celery queues.      |
| **Workers**     | Celery                  | Async tasks (OTPs, Location Sync, Stale Cleanup). |
| **Routing**     | OSRM (C++ Engine)       | High-speed routing engine for ETA & Distances.    |
| **Proxy**       | Nginx                   | Unified entry point and request routing.          |

---

## 🚀 Key Features

### **🗺️ Real-Time Geospatial Engine**
- **Live Tracking:** Sub-second GPS updates via WebSockets for both drivers and passengers.
- **Smart ETA:** Integrated OSRM `Table API` for calculating live ETAs to the next 3 stops.
- **Geospatial Buffering:** 10-meter matching logic to detect when a vehicle arrives at a stop.
- **Redis GEO:** High-performance spatial indexing for finding "Nearby Buses" and "Nearby Stops."

### **🛠️ Admin Panel (City/University)**
- **Route Creator:** Drag-and-drop map interface to design complex routes with ordered stops.
- **City Management:** Support for multiple cities, each with isolated routes and vehicles.
- **User Management:** Granular roles: `Admin`, `City Admin`, `Driver`, and `Passenger`.
- **Vehicle Assignment:** Lock drivers to specific vehicles and vehicles to specific routes.

### **📱 Driver Experience**
- **One-Tap Trip Start:** Easy "Start Trip" interface with route selection.
- **Live Passenger Count:** Real-time visibility into students/passengers waiting at upcoming stops.
- **Status Sync:** Automated "Offline" detection if a driver loses connection or closes the app.

### **乘客 Passenger Experience**
- **Live Map:** Interactive Leaflet map showing assigned route polylines and live bus positions.
- **OTP Onboarding:** Secure password-less or password-reset flow via 6-digit OTPs.
- **Nearby Search:** Nominatim-powered global search to find routes near any location.
- **Resilient Connection:** Auto-reconnecting WebSockets and JWT rotation (Access/Refresh).

---

## 📁 Project Structure

```text
vayy/
├── backend/                # Django/GeoDjango Project
│   ├── core/               # Main application logic (Models, Views, Consumers)
│   │   ├── api/            # DRF Serializers & ViewSets
│   │   ├── migrations/     # PostGIS schema migrations
│   │   ├── tasks.py        # Celery background tasks
│   │   ├── consumers.py    # WebSocket logic
│   │   └── utils.py        # OSRM & Geospatial helpers
│   ├── vayy/               # Project settings (ASGI, WSGI, Celery)
│   └── osrm-data/          # OSRM Graph & Map data (.pbf)
├── frontend/               # React Vite SPA
│   ├── src/
│   │   ├── components/     # UI & Map Components (Leaflet)
│   │   ├── features/       # Redux Slices (Auth, Trip)
│   │   ├── pages/          # Admin, Dashboard, Auth pages
│   │   └── utils/          # API Axios instance & WS helpers
└── docker-compose.yaml     # Infrastructure & Service Orchestration
```

---

## 🐳 Docker Deployment Setup (Recommended)

### 1. Map Data Preparation
Create `backend/osrm-data/` and place your `.osm.pbf` file there (e.g., from [Geofabrik](https://download.geofabrik.de/)). **Rename it** to `map.osm.pbf`.

```bash
mkdir -p backend/osrm-data
# Move your downloaded file there:
mv india-latest.osm.pbf backend/osrm-data/map.osm.pbf
```

### 2. Launch Services
```bash
docker-compose up -d --build
```
This automatically processes the map data, runs migrations, and starts the Nginx proxy.

**Ports Mapping (Internal via Nginx):**
- **Web App:** [http://localhost](http://localhost) (Port 80)
- **API Admin:** [http://localhost/admin/](http://localhost/admin/)
- **OSRM Engine:** `http://localhost:5000`

---

## 🛠 Local Development

### Prerequisites
- Python 3.10+ & Node.js 20+
- **GDAL/GEOS** (Required for GeoDjango)
- PostgreSQL with **PostGIS** extension

### Backend Setup
```bash
cd backend
python -m venv venv && source venv/bin/activate
pip install -r requirements.txt
python manage.py migrate
# Terminals:
python manage.py runserver  # API
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

## 🔐 Environment Variables

| Variable | Description | Default |
| :--- | :--- | :--- |
| `DATABASE_URL` | PostGIS connection string | `postgis://...` |
| `REDIS_URL` | Redis connection for Cache/PubSub | `redis://redis:6379/0` |
| `OSRM_URL` | OSRM Engine endpoint | `http://osrm:5000` |
| `SECRET_KEY` | Django security key | (Change in Prod) |
| `VITE_API_URL` | Frontend API endpoint | `http://localhost:8000` |
| `VITE_WS_URL` | Frontend WebSocket endpoint | `ws://localhost:8001` |

---

## 📜 API Endpoints (Core)

#### Authentication
- `POST /api/auth/login/`: JWT login (Access + Refresh).
- `POST /api/auth/send-otp/`: Send 6-digit OTP to email.
- `POST /api/auth/verify-otp/`: Verify OTP and get a temporary verification token.
- `POST /api/auth/set-password/`: Finalize registration/reset with verification token.

#### Tracking & Trips
- `POST /api/driver/start-trip/`: Driver starts a live trip.
- `POST /api/trips/end/<id>/`: End an active trip.
- `GET /api/dashboard/`: Passenger's live dashboard view (Near-realtime).
- `GET /api/search/global/?q=...`: Nominatim address search.

---

## 🔧 Troubleshooting

### "OSRM Missing Files"
- **Cause**: The OSRM container is still processing the `.pbf` map file.
- **Fix**: Run `docker-compose logs -f osrm`. Wait until you see `Starting OSRM...`.

### "PostGIS Compatibility on M1/M2/M3"
- **Fix**: The `docker-compose.yaml` uses `platform: linux/amd64` for the `db` and `osrm` containers to ensure stability on Apple Silicon.

### "WebSocket Connection Refused"
- **Fix**: Ensure `daphne` is running and the `VITE_WS_URL` is correctly set. In Docker, this is handled by the Nginx proxy and service orchestration.
