# VAYY Project Overview

VAYY is a route-first mobility platform for passengers and drivers. It combines route discovery, dynamic route preview, auto/bike workflows, trip operations, document verification, notifications and live tracking.

## Applications

| Application | Directory | What it does |
|---|---|---|
| API/backend | `backend/vayy/` | Django REST APIs, persistence, geospatial logic, Channels and Celery tasks |
| Admin console | `admin/` | Operational dashboards, routing configuration, driver verification, users and KPIs |
| Web client | `frontend/` | Passenger/driver browser experience, route planning and tracking |
| Mobile client | `vayy_app/` | Expo/React Native passenger and driver app for Android/iOS |

## Start with the documentation

- [Documentation index](README.md)
- [System architecture](architecture/system-overview.md)
- [Backend guide](backend/README.md) and [API reference](backend/api-reference.md)
- [Admin console](admin/README.md)
- [Web frontend](frontend/README.md)
- [Mobile app](vayy_app/README.md)
- [Docker/deployment operations](operations/deployment.md)

## Architecture at a glance

- **Durable data:** PostgreSQL/PostGIS, accessed through Django models and services.
- **HTTP API:** Django REST Framework grouped under `/api/accounts/`, `/api/transport/`, `/api/operations/`, `/api/tracking/`, `/api/communication/`, `/api/ride/` and `/api/kpi/`.
- **Real time:** Django Channels/Daphne and Redis channel layers for WebSocket flows.
- **Background work:** Celery with the broker and result backend configured by environment variables (the current settings default to RabbitMQ/AMQP for the broker and Redis for results).
- **Routing:** OSRM-backed road geometry and distance/ETA services where configured.
- **Clients:** Two web SPAs (`admin/`, `frontend/`) plus the Expo mobile app (`vayy_app/`).

## Repository rules

1. Treat backend API permissions and business state as authoritative; client visibility is not authorization.
2. Preserve existing staged/unstaged work when making changes.
3. Do not commit secrets, credentials, private keys, or local `.env` files.
4. Keep route/coordinate conventions consistent: GeoJSON coordinate pairs are `[longitude, latitude]`.
5. Update docs under `docs/` when APIs, route paths, env variables, or workflows change.
6. Distinguish confirmed behavior from proposed architecture and unverified production assumptions.

## Scope note

Documentation is based on source inspection and existing audit notes. It is not a claim that all features have been end-to-end tested or that the deployment is production-ready. Use the deployment checklist and actual environment smoke tests before shipping.
