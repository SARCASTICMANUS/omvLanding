# VAYY Coding Instructions

The canonical engineering and product documentation is in docs/. Start with the system overview, project mandates, and the relevant app guide before making cross-cutting changes.

## Current repository layout

- backend/vayy/: Django 6 / DRF API, PostGIS domain models, Channels/Daphne consumers and Celery tasks.
- frontend/: React/Vite passenger and driver web client.
- admin/: React/Vite operations console.
- vayy_app/: Expo/React Native mobile app.
- docker-compose.yaml, docker-compose-prod.yaml, nginx.conf, nginx.prod.conf: deployment and routing configuration.

The current Django domains are accounts, transport, operations, tracking, communication, kpi, and shared support modules. Do not assume the old backend/core/ layout described in legacy notes is present.

## Non-negotiable engineering rules

1. Inspect Git status and preserve staged/unstaged user work. Never reset, clean, or overwrite unrelated changes.
2. PostgreSQL/PostGIS is the durable store. Redis is configured for cache/channel-layer use; inspect the actual implementation before assuming a data path uses Redis GEO or batching.
3. Use OSRM for road geometry and road distance/ETA when configured. GeoJSON coordinates are [longitude, latitude].
4. Use backend permissions and service/business rules as the authority for KYC, trip state, payments and role access.
5. Keep API response normalization in service/normalizer layers and inspect all web/admin/mobile callers before changing a contract.
6. Keep real-time connection lifecycle centralized in the existing socket infrastructure. Use current event/consumer contracts rather than inventing event names.
7. Never commit secrets, credentials, private keys, real tokens, OTPs or private user documents.
8. Avoid unrelated UI redesigns during bug fixes. Move files only when requested and after checking imports/builds.
9. Keep engineering documentation under docs/. Keep this file and scoped AGENTS.md files at their discovery locations for coding tools.

## Validation and reporting

Run the narrowest useful check, followed by broader build/test checks when feasible. Distinguish successful lint/build/system checks from live-device tests, external service integration, and production validation. State untested areas explicitly.

## Useful starting points

- docs/README.md — documentation index
- docs/backend/README.md — backend and endpoints
- docs/backend/api-reference.md — API reference
- docs/admin/README.md — admin console
- docs/frontend/README.md — web frontend
- docs/vayy_app/README.md — mobile app
- docs/operations/deployment.md — deployment checklist
