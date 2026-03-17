# 🚖 Vayy - Institutional Bus Tracking Platform

**Vayy** is a production-grade, real-time geospatial platform designed for university and institutional bus tracking. Built to handle concurrency and provide a great passenger experience, Vayy connects student passengers with fixed-route buses.

It features a **10-meter geospatial buffer matching system**, real-time WebSocket tracking, bus capacity tracking (via "next stops" prediction), an automated One-Time-Password (OTP) onboarding flow, and a dedicated Admin Route Creator.

## 🏗 System Architecture

The project is built to handle high concurrency by offloading geospatial calculations to OSRM, real-time state to Redis, and heavy tasks to Celery.

| Service       | Technology              | Purpose                                           |
| :------------ | :---------------------- | :------------------------------------------------ |
| **Frontend**  | React + Vite + Tailwind | User Interface (Leaflet Maps, Redux Persist).     |
| **Backend**   | Django + GeoDjango      | API, Auth, Database Management.                   |
| **WebSockets**| Daphne (ASGI)           | WebSocket handling for live map rendering.        |
| **Database**  | PostgreSQL + PostGIS    | Persistent storage for Routes & Spatial Indexing. |
| **Cache/PubSub**| Redis                   | Ephemeral storage for live GPS & Celery queues.   |
| **Workers**   | Celery                  | Asynchronous tasks (Emails, OTPs, Bulk Uploads).  |
| **Routing**   | OSRM (C++ Engine)       | High-speed routing engine for ETA & Distances.    |
| **Proxy**     | Nginx                   | Load balancer and request routing.                |

---

## 🚀 Features

### **Admin Capabilities**
- Map-based drag-and-drop Route Creator.
- Stop sequencing and organization.
- Background asynchronous CSV/Excel student roster uploads.
- Secure University/Campus management.

### **Driver Capabilities**
- Intuitive "Start Trip" interface locking to assigned vehicles.
- "Next 3 Stops" tracking panel showing the count of waiting students at upcoming stops.
- Live GPS broadcasting over optimized WebSockets.

### **Passenger (Student) Capabilities**
- Polished dashboard with assigned route map polyline.
- Expiration warnings for invalid bus passes to prevent boarding issues.
- Live tracking of *all* active buses on their assigned route simultaneously.
- Real-time ETA calculations to their specific designated pickup stop.
- Auto-reconnecting resilient WebSockets.

---

## 🐳 Docker Deployment Setup (Recommended)

The entire stack is containerized for simple bringing up.

### 1. File Structure Setup

Create a folder named `osrm-data` in the project root and place your downloaded `.osm.pbf` map file there. **Rename it** to `map.osm.pbf`. 
*Note: You can download map data from the [Geofabrik Download Server](https://download.geofabrik.de/).*

```text
vayy/
├── backend/
├── frontend/
├── docker-compose.yml
├── nginx.conf
└── osrm-data/
    └── map.osm.pbf  <-- CRITICAL: Must be named exactly this
```

### 2. Run with Docker Compose

This command sets up the Database, Redis, OSRM, Backend, Async Workers, and Frontend proxy automatically.

```bash
docker-compose up -d --build
```

**What happens automatically?**

1.  **OSRM Container**: Detects the `.pbf` file, extracts the graph, and starts the routing service.
2.  **Database**: Starts PostgreSQL with PostGIS extensions on port 5435 to avoid local conflicts.
3.  **Backend**: Waits for DB, runs Django API on `8000`.
4.  **Daphne**: Starts ASGI server for WebSockets on `8001`.
5.  **Celery + Beat**: Starts background task workers for email rendering and inactive trip cleanup.
6.  **Frontend**: Starts the Vite SPA.
7.  **Nginx**: Reverse proxies traffic based on URL (`/api/`, `/ws/`, `/`).

### 3. Access the App

- **Frontend App:** [http://localhost](http://localhost) (via Nginx)
- **Direct Frontend (dev):** [http://localhost:3000](http://localhost:3000)
- **Django Admin:** [http://localhost/admin/](http://localhost/admin/)

---

## 🛠 Manual / Local Development Setup

If you want to run the code locally (outside Docker) for debugging:

### 1. Start Infrastructure Only
```bash
docker-compose up -d db redis osrm
```

### 2. Backend Setup
*Requires Python 3.10+ and GDAL installed on your OS.*
```bash
cd backend
python -m venv venv
source venv/bin/activate  # or .\venv\Scripts\activate on Windows
pip install -r requirements.txt

# Run Migrations
python manage.py migrate

# Terminal 1: Run Django Server
python manage.py runserver

# Terminal 2: Run Daphne WebSockets
daphne -b 127.0.0.1 -p 8001 vayy.asgi:application

# Terminal 3: Run Celery Worker
celery -A vayy worker -l info
```

### 3. Frontend Setup
*Requires Node.js 20+*
```bash
cd frontend
npm install
npm run dev
```

---

## 📜 Selected API Core Endpoints

#### Authentication
- `POST /api/auth/send-otp/`: Request an OTP for login or reset.
- `POST /api/auth/verify-otp/`: Verify a 6-digit OTP code to receive a short-lived token.
- `POST /api/auth/set-password/`: Set a new password using the verification token.
- `POST /api/auth/login/`: Receive JWT Access and Refresh tokens.

#### Driver & Trip Sync
- `POST /api/driver/start-trip/`: Initialize a new live trip, locked to the driver.
- `GET /api/trips/next-stops/<trip_id>/`: Return student counts for the next 3 upcoming stops.
- `POST /api/trips/end/<trip_id>/`: Mark a trip as completed.

#### Administration
- `POST /api/admin/students/bulk-upload/`: Async multipart form upload for Excel/CSV student rosters.
- `POST /api/admin/routes/`: Create a new geographic route by passing a series of coordinate stops.

---

## 🔧 Troubleshooting

### "OSRM Missing Files"
* **Cause**: The OSRM container hasn't finished processing the map data yet on first boot.
* **Fix**: Check `docker-compose logs -f osrm`. Wait until processing ends.

### "Celery Worker Disconnected"
* **Cause**: Redis may have crashed or restarted abruptly.
* **Fix**: Run `docker-compose restart celery_worker`.

### "Token Expired Loop on Frontend"
* **Cause**: Rare edge case where both access and refresh tokens expire simultaneously during a request transit.
* **Fix**: The React Redux Persist store automatically handles this, but clearing localStorage is a fast hard-reset.
