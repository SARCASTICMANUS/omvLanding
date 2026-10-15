# Backend Guide

## Overview

The backend is a Django/DRF project rooted at `backend/vayy/`, with settings package `vayy`. The root URL configuration exposes REST API groups, health check, Django admin, and OpenAPI documentation. Django ASGI is configured for Channels/Daphne. PostgreSQL/PostGIS is the durable data store; Redis is configured for caching and Channels; Celery is configured for background work.

## Main paths

- `vayy/settings.py` — environment-driven settings, database, REST framework, JWT, cache, Channels, Celery and OSRM configuration.
- `vayy/urls.py` — top-level API prefixes and schema/docs endpoints.
- `vayy/asgi.py`, `vayy/wsgi.py` — ASGI and WSGI entry points.
- `accounts/`, `transport/`, `operations/`, `tracking/`, `communication/`, `kpi/` — domain apps.
- `*/api/` — DRF endpoint implementation, serializers and URL registration.
- `*/services/` and `*/selectors/` — domain operations and query helpers where present.
- `*/consumers/`, `*/websockets/` — real-time channel handling.
- `*/management/` — custom Django management commands.
- `tests/` and app-level tests — automated tests.

## Domain ownership

| App | Responsibilities |
|---|---|
| `accounts` | OTP/authentication, user and profile APIs, driver documents, verification status, wallet and payment pipeline, recent searches, push tokens |
| `transport` | City, route, stop, schedule and stop-time APIs; geocoding; route geometry and preview; dynamic routing; road distance and walking paths |
| `operations` | Vehicles, active trips, dispatch state, boarding requests, fares, driver/document admin verification |
| `tracking` | GPS and telemetry ingestion, vehicle and trip tracking, passenger/driver locations, journeys, raise-hand and route-trip lifecycle |
| `communication` | Notifications, read/delete state, preferences and waitlist |
| `kpi` | Analytics, page view tracking, snapshots, geographic statistics |
| `common`, `geoip`, `media`, `osrm` | Shared infrastructure and integrations |

## Important route groups

The root URL configuration registers:

- `/healthz/`
- `/api/schema/`, `/api/docs/`, `/api/redoc/`
- `/api/accounts/`
- `/api/transport/`
- `/api/operations/`
- `/api/tracking/`
- `/api/communication/`
- `/api/ride/` (operations ride URL configuration)
- `/api/kpi/`
- `/django-admin/`

See [API reference](api-reference.md) for endpoint families. The live schema is the best source for exact serializer fields and permissions.

## Local development

From repository root:

```bash
cd backend/vayy
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
python manage.py check
python manage.py migrate
python manage.py runserver 0.0.0.0:8000
```

This requires a working database configured in environment variables, with PostGIS enabled. Use a separate environment for local testing; do not copy production credentials into a development `.env`.

## Useful commands

```bash
python manage.py check
python manage.py showmigrations
python manage.py migrate
python manage.py createsuperuser
python manage.py spectacular --file /tmp/vayy-openapi.yaml
```

If running through Compose, use `docker compose ps`, `docker compose logs -f web`, and `docker compose exec web python manage.py check` from repository root. Confirm the actual service names in `docker compose config --services` first.

## Authentication and security

- Use access tokens for authenticated APIs and the token refresh endpoint for renewal.
- Never log tokens, OTP values, payment secrets, uploaded document contents, or personal identifiers.
- Payment order creation records an intent; the code comments state the webhook is the path that credits a wallet. Do not credit balances based only on a client success callback.
- Driver KYC status must be computed from required documents and backend verification state, not only from the account OTP flag.
- Admin-only endpoints must be protected server-side; hiding controls in the UI is not authorization.

## Real-time and background work

ASGI/Channels serves WebSocket traffic. Redis is configured as the channel layer and cache. Celery uses the configured broker/backend and task routing in settings. Inspect the task implementation and Compose configuration before assuming a given worker, scheduler, broker or OSRM data set is running.

## Testing and limitations

Run targeted app tests first, then the full suite. A Django system check does not prove all database migrations, external integrations, permissions, WebSocket flows, or payment webhooks are correct. Some test database setups may require PostGIS extensions such as `pg_trgm`/trigram indexes to be installed by the database image.
