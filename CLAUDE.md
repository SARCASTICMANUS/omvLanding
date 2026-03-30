# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Vayy** is a real-time university bus tracking platform. It consists of a Django/Channels backend and a React frontend, orchestrated via Docker Compose with PostGIS, Redis, OSRM, Celery, and Nginx.

## Development Commands

### Full Stack (Docker — recommended)
```bash
docker-compose up -d --build
# Frontend: http://localhost | Django Admin: http://localhost/admin/
```
OSRM requires an OSM `.pbf` file placed at `osrm-data/map.osm.pbf` before first run.

### Local Development (Manual)
```bash
# Start only infrastructure
docker-compose up -d db redis osrm

# Backend (Django HTTP)
cd backend && source venv/bin/activate
python manage.py migrate
python manage.py runserver          # :8000

# WebSocket server (separate process)
daphne -b 127.0.0.1 -p 8001 vayy.asgi:application

# Celery worker
celery -A vayy worker -l info

# Frontend
cd frontend && npm run dev          # :3000
```

### Frontend Scripts
```bash
npm run dev       # Vite dev server
npm run build     # Production build
npm run lint      # ESLint
npm run preview   # Preview production build
```

### Django Management
```bash
python manage.py makemigrations
python manage.py migrate
python manage.py createsuperuser
```

## Architecture

### Infrastructure
Nginx (`:80`) reverse-proxies:
- `/api/*` and `/admin/*` → Django HTTP (`:8000`)
- `/ws/*` → Daphne WebSocket server (`:8001`)
- `/` → Vite frontend (`:3000`)

Services: PostgreSQL 15 + PostGIS, Redis 7 (cache + channel layer), OSRM (routing), Celery + Celery Beat (async tasks).

### Backend (`backend/`)

**Framework:** Django 4.2 + Django REST Framework + Django Channels (ASGI)

**Key models** (`core/models.py`):
- `User` — Custom AbstractUser with roles: `student`, `driver`, `university_admin`, `admin`
- `Route` / `Stop` — LineString paths with ordered geospatial stops
- `Vehicle` — Bus/van assigned to a driver
- `ActiveTrip` — Live trip with current location, status, and timestamps
- `StudentProfile` / `DriverProfile` — Role-specific extended data
- `StudentAssignment` — Maps students to vehicles

**Auth flow** (`core/api/views.py:AuthView`): 3-step OTP — send OTP → verify OTP → set password. Uses Simple JWT for subsequent requests.

**Real-time** (`core/consumers.py:VayyConsumer`): Drivers send location over WebSocket; server stores position in Redis GEO (ephemeral) and broadcasts ETAs to passenger group. ETAs computed via OSRM Table API.

**Celery tasks** (`core/tasks.py`): `cleanup_inactive_trips` (60s), `cleanup_stale_passengers` (5min), `sync_locations_redis_to_db` (2min).

**URL structure** (`vayy/urls.py`):
- `/api/auth/` — OTP auth + JWT endpoints
- `/api/admin/` — Route creation, bulk student upload
- `/api/driver/` — Trip start/end, next-stops
- `/api/passenger/` — Geospatial match, nearby stops, student dashboard
- `/api/universities/`, `/vehicles/`, `/assignments/` — Resource endpoints

**WebSocket channels** (`core/routing.py`):
- `ws/tracking/<university_id>/<role>/[trip_id/]`
- `ws/trip/<trip_id>/<role>/`

### Frontend (`frontend/`)

**Framework:** React 19 + Vite 7 + Redux Toolkit + React Router v7 + Leaflet (react-leaflet v5)

**State:** Redux with Redux Persist (auth slice persisted to localStorage). Store at `src/app/store.js`, auth slice at `src/features/auth/authSlice.js`.

**Role-based routing** (`src/App.jsx`): `DashboardRouter` redirects after login based on role:
- `admin` / `university_admin` → `AdminPanel`
- `driver` → `MapDriver`
- `student` / `passenger` → `MapPassenger`

**Key components:**
- `Maps/MapDriver.jsx` — Driver interface: start trip, broadcasts GPS via WebSocket
- `Maps/MapPassenger.jsx` — Passenger view: live bus position, ETA, route polyline
- `AdminRouteManager.jsx` — Interactive Leaflet map for drag-and-drop route creation
- `AdminUsersManager.jsx` — User CRUD
- `PassengersManager.jsx` — Bulk Excel/CSV student upload + vehicle assignment

**HTTP client:** Axios with JWT interceptors; auto-refreshes token on 401. Base URL: `VITE_API_URL` (defaults to `http://localhost:8000`).

## Environment Variables

Backend defaults are set in `backend/.env` (dev) and `docker-compose.yaml` (Docker):
- `DATABASE_URL`, `REDIS_URL`, `OSRM_URL`, `SECRET_KEY`, `DEBUG`, `CORS_ALLOWED_ORIGINS`

Frontend (Vite):
- `VITE_API_URL=http://localhost:8000`
- `VITE_WS_URL=ws://localhost:8001`

## Key Design Decisions

- **Dual servers:** HTTP (Django `runserver` / gunicorn) and WebSocket (Daphne) run as separate processes and communicate through the Redis channel layer.
- **Ephemeral vs. persistent location:** Driver GPS is stored in Redis GEO for real-time lookup; Celery syncs positions to PostGIS every 2 minutes for history.
- **Geospatial matching:** `PassengerMatchView` uses a 10-meter PostGIS buffer to determine if a student is eligible to board.
- **OSRM dependency:** ETAs and route geometry depend on OSRM being reachable. If the container is missing the `.pbf` file, ETA features will silently fail or return errors.
- **Migrations:** New PostGIS spatial field migrations require GeoDjango/GDAL on the host machine or inside the Docker container.
