# VAYY System Overview

## Product summary

VAYY is a route-first mobility platform for passengers and drivers. It supports route discovery and matching, fixed routes and dynamically previewed journeys, vehicle/trip operations, passenger-driver handshakes, document verification, and live tracking.

## Repository components

| Directory | Responsibility | Main technologies |
|---|---|---|
| `backend/vayy/` | REST APIs, business rules, persistence, real-time consumers and jobs | Django 6, DRF, GeoDjango/PostGIS, Channels/Daphne, Celery |
| `frontend/` | Passenger and driver web workflows and live tracking | React, Vite, Redux Toolkit, Axios, MapLibre |
| `admin/` | Admin dashboard and operational management | React, Vite, React Router, Axios, MapLibre |
| `vayy_app/` | Android/iOS client and optional web target | Expo SDK 54, React Native 0.81, React Navigation, Redux Toolkit, MapLibre |
| `docker-compose.yaml` | Local container orchestration | Docker Compose, app services, Nginx and supporting services |
| `docker-compose-prod.yaml` | Production-oriented service configuration | Docker Compose and Nginx production config |

The directory names reflect separate deployable clients. The Django backend is the API source of truth; client-side types/normalizers should follow the response contracts implemented there.

## Backend domain boundaries

- **accounts** — registration/login/OTP, user/profile APIs, wallets and payment order/webhook endpoints, driver documents/KYC, recent searches and push-token registration.
- **transport** — cities, fixed routes, stops, schedules, stop times, geocoding, route geometry, OSRM-backed preview/distance/walking paths, and dynamic route preview/generation.
- **operations** — vehicles, active trips, dispatch, boarding requests, driver/document verification, fare configuration and trip operational state.
- **tracking** — GPS/telemetry ingestion, nearby vehicles/routes, passenger/driver location, journeys, route trip lifecycle, raise-hand and passing-vehicle workflows.
- **communication** — notifications, preferences and waitlist.
- **kpi** — page-view tracking, platform overview, snapshots and geographic/admin statistics.
- **common**, **geoip**, **media**, **osrm** — cross-cutting helpers, IP/geolocation support, media/configuration and routing integration.

## Typical request/data flow

1. A client obtains an access token through account endpoints and sends authenticated API requests.
2. Location search uses the registered geocoding endpoints under `/api/transport/geocode/`.
3. Fixed route and stop discovery uses transport APIs; dynamic trip planning calls `/api/transport/routes/dynamic-preview/`.
4. Operational actions (vehicle, trip, dispatch, boarding and KYC) go through accounts/operations/tracking APIs.
5. Real-time connections are served by Django Channels through the ASGI application. Redis is configured for channel/cache and transient state; Celery runs background work.
6. PostgreSQL/PostGIS stores durable relational and spatial data. OSRM supplies road-based route geometry/distance/ETA where configured.

## Geospatial conventions

- Coordinate input objects use named latitude and longitude fields. Route geometry follows GeoJSON order: each coordinate pair is **[longitude, latitude]**.
- Use PostGIS for durable spatial queries and Redis GEO for high-frequency live-location lookups when those paths are implemented.
- Use OSRM road routing for route geometry and road distance/ETA; do not substitute straight-line distance for a road ETA.
- Validate missing, non-finite and zero-valued coordinates correctly. A latitude/longitude of zero is a valid numeric value in some places and must not be rejected by truthiness checks alone.

## Client responsibilities

- `admin/`: manage city and route configuration, driver verification, user directory, fares and KPIs.
- `frontend/`: passenger/driver web experience, profiles, route and trip workflows, tracking and notifications.
- `vayy_app/`: native-oriented passenger/driver journeys, route search, map presentation, KYC screens and mobile navigation.
- Avoid duplicating business authorization or verification decisions in clients. The backend must enforce permissions and state transitions.

## Truth vs. roadmap

This guide describes the repository structure and route registrations inspected in the current source. Capacity figures, service-level targets, and any proposed move to Kafka, Tile38, Go/Node ingestion or multi-region deployment are architectural recommendations, not proof that those components are currently deployed. See [scalability report](scalability-report.md).
