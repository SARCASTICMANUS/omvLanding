Here is the complete **README.md** file. You can create a file named `README.md` in your project root and paste this content.

It covers everything from architecture to specific commands for Docker and Local development.

---

# 🚖 Vayy - Real-Time Commuter Tracking Platform

**Vayy** is a scalable, real-time geospatial platform that connects passengers with fixed-route vehicles (Buses/Shuttles). It features a **10-meter geospatial buffer matching system**, real-time WebSocket tracking, and a dedicated Admin Route Creator.

## 🏗 System Architecture

The project is built to handle high concurrency ("millions of users") by offloading geospatial calculations to OSRM and real-time state to Redis.

| Service       | Technology              | Purpose                                           |
| :------------ | :---------------------- | :------------------------------------------------ |
| **Frontend**  | React + Vite + Tailwind | User Interface (Leaflet Maps).                    |
| **Backend**   | Django + GeoDjango      | API, Auth, Database Management.                   |
| **Real-Time** | Django Channels (ASGI)  | WebSocket handling for live tracking.             |
| **Database**  | PostgreSQL + PostGIS    | Persistent storage for Routes & Spatial Indexing. |
| **Cache**     | Redis                   | Ephemeral storage for live Driver GPS & Pub/Sub.  |
| **Routing**   | OSRM (C++ Engine)       | High-speed routing engine for ETA & Distances.    |

---

## 🚀 Prerequisites

Before you begin, ensure you have:

1.  **Docker Desktop** (Installed and running).
2.  **Map Data**: This project requires raw map data (`.osm.pbf`) to calculate routes.
    - Go to [Geofabrik Download Server](https://download.geofabrik.de/).
    - Download the region you want to test (e.g., `north-america/us/delaware-latest.osm.pbf` for a small test file).

---

## 📂 Project Setup (The "Golden Path")

### 1. File Structure Setup

Create a folder named `osrm-data` in the project root and place your downloaded map file there. **Rename it** to `map.osm.pbf`.

```text
vayy/
├── backend/
├── frontend/
├── docker-compose.yml
└── osrm-data/
    └── map.osm.pbf  <-- CRITICAL: Must be named exactly this
```

### 2. Run with Docker Compose

This command sets up the Database, Redis, OSRM, Backend, and Frontend automatically.

```bash
docker-compose up -d --build
```

**What happens automatically?**

1.  **OSRM Container**: Detects the `.pbf` file, processes the road graph (Extract/Partition/Customize), and starts the server.
2.  **Database**: Starts PostgreSQL with PostGIS extensions.
3.  **Backend**: Waits for DB, runs migrations, creates a default Superuser, and starts the Daphne server.
4.  **Frontend**: Installs Node modules and starts the Vite server.

### 3. Access the App

- **Frontend:** [http://localhost:3000](http://localhost:3000)
- **Backend API:** [http://localhost:8000/api/](http://localhost:8000/api/)
- **Django Admin:** [http://localhost:8000/admin/](http://localhost:8000/admin/)

**Default Superuser Credentials:**

- **Username:** `root`
- **Password:** `zxcv9876`

---

## 🛠 Manual / Local Development Setup

If you want to run the code locally (outside Docker) for debugging, follow these steps.

### 1. Start Infrastructure Only

You still need the Database, Redis, and OSRM running. Docker is the best way to run these.

```bash
# Run only infrastructure services
docker-compose up -d db redis osrm
```

### 2. Backend Setup (Windows/Linux)

**Prerequisites:** Python 3.10+

- **Windows Users:** You MUST install **GDAL** via [OSGeo4W](https://trac.osgeo.org/osgeo4w/).
- **Linux Users:** `sudo apt-get install gdal-bin libgdal-dev`

```bash
cd backend

# 1. Create Virtual Environment
python -m venv venv

# 2. Activate
# Windows:
.\venv\Scripts\activate
# Mac/Linux:
source venv/bin/activate

# 3. Install Dependencies
pip install -r requirements.txt

# 4. Run Migrations
python manage.py migrate

# 5. Run Server
daphne -b 127.0.0.1 -p 8000 vayy.asgi:application
```

### 3. Frontend Setup

**Prerequisites:** Node.js 20+

```bash
cd frontend

# 1. Install Dependencies
npm install

# 2. Start Dev Server
npm run dev
```

Access at `http://localhost:5173` (or `3000` depending on Vite config).

---

## 📱 User Guide

### 1. Admin: Create a Route

1.  Go to the Home Page.
2.  Click the **"🔧 Admin Panel"** button (Bottom Right).
3.  **Create Route:**
    - Search for "Start" (e.g., _Central Park_).
    - Search for "End" (e.g., _Times Square_).
    - Or click points on the map.
    - Click **"Save Route"**.
4.  The route is now saved in PostGIS.

### 2. Driver: Start a Trip

1.  Go to Home -> **Driver**.
2.  Select the route you created from the dropdown.
3.  Click **"Load Route"** -> **"Start Engine"**.
4.  The simulation begins. Your location is broadcasted via WebSockets.

### 3. Passenger: Track a Vehicle

1.  Go to Home -> **Passenger**.
2.  Search your location (Must be within **10 meters** of the driver's route).
3.  Click **"Scan for Vehicles"**.
4.  If the driver is active and near your route, you will see "Found 1 Vehicle".
5.  Click the vehicle card to see the live map, bus path, and ETA.

---

## 🔧 Troubleshooting

### 1. "OSRM Missing Files" or "Connection Refused"

- **Cause:** The OSRM container hasn't finished processing the map data yet.
- **Fix:** Check logs: `docker-compose logs -f osrm`. Wait until you see `running and waiting for requests`.

### 2. "GDALException" or "WinError 127" (Windows)

- **Cause:** Trying to run Django locally without OSGeo4W installed.
- **Fix:** Use the Docker setup (`docker-compose up`). It handles GDAL for you.

### 3. "Vite requires Node.js version 20.19+"

- **Cause:** Your local Node version is old.
- **Fix:** Upgrade Node.js or use the Docker setup (which uses Node 22).

### 4. ETA is "Updating..." forever

- **Cause:** The passenger must send a heartbeat to calculate ETA.
- **Fix:** Ensure the WebSocket connection is open. The frontend automatically sends a heartbeat every 4 seconds.

---

## 📜 API Endpoints

| Method | Endpoint                    | Description                                  |
| :----- | :-------------------------- | :------------------------------------------- |
| `GET`  | `/api/global-search/?q=...` | Search for a real-world address (Nominatim). |
| `POST` | `/api/admin/routes/`        | Create a new fixed route.                    |
| `GET`  | `/api/driver/routes/`       | List all available routes.                   |
| `POST` | `/api/driver/start-trip/`   | Driver starts a session on a route.          |
| `POST` | `/api/passenger/match/`     | Find active vehicles within 10m of a point.  |

---

## 🐳 Docker Commands Cheatsheet

```bash
# Start everything
docker-compose up -d --build

# Stop everything
docker-compose down

# Stop and DELETE DATABASE (Fresh Start)
docker-compose down -v

# View Backend Logs
docker-compose logs -f backend

# View OSRM Logs
docker-compose logs -f osrm

# Open Shell inside Backend
docker-compose exec backend /bin/bash
```
