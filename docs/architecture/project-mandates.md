# VAYY Engineering Mandates

These rules guide changes across the current repository. The current implementation lives under `backend/vayy/`, `frontend/`, `admin/`, and `vayy_app/`; older references to `backend/core/` in legacy documents do not describe the current Django app layout.

## Data ownership and consistency

1. PostgreSQL/PostGIS is the durable source of truth for accounts, route definitions, vehicles, trip records and other persisted business data.
2. Redis is configured for caching and Channels. Use it for short-lived/high-frequency state only where the corresponding code path already supports it; do not assume every transient-state design described in old notes has been fully implemented.
3. Route and trip state transitions must be enforced by backend services/API permissions, not by UI state alone.
4. Payment credits must follow the verified server-side payment/webhook path. Never credit a wallet from a client-only success callback.
5. Driver KYC status must reflect the required document verification rules. Account OTP verification and KYC/document verification are separate concepts.

## Geospatial rules

- Use PostGIS-backed queries for persisted spatial data.
- Use OSRM for road route geometry and road distance/ETA when configured. Do not represent straight-line distance as road distance.
- Use GeoJSON coordinate pairs in `[longitude, latitude]` order.
- Validate coordinates explicitly: reject missing, non-numeric and non-finite values, but do not use truthiness checks that accidentally reject valid zero coordinates.
- Handle missing city metadata explicitly. Do not silently pick an arbitrary city when multiple candidate service cities exist.

## Real-time and background processing

- ASGI/Channels is the WebSocket path; use the configured channel layer and existing consumer/event contracts.
- Keep socket connection lifecycle and reconnection logic centralized in the client socket manager/service where one exists.
- Avoid sending entire domain objects at high frequency when a small delta is sufficient.
- Celery broker/result backend and queue routing are environment/settings-driven. Confirm the active Compose worker command and task routing before adding a queue.
- Do not claim a task is asynchronous or a stream is persisted unless the actual path is implemented and tested.

## API/client contract rules

1. Treat the DRF serializers, views and live OpenAPI schema as the API source of truth.
2. Normalize inconsistent envelopes and legacy payload variants in a service/normalizer layer rather than spreading fallback parsing through screens.
3. When changing an API response, inspect all callers across admin, web and mobile clients.
4. Preserve authentication, role checks and pagination behavior.
5. Do not log bearer tokens, OTP values, payment secrets, document URLs/content or unnecessary personal data.
6. Use `.env.example` for documented variable names; never copy actual secret values into docs.

## Change safety

- Inspect current Git status before editing and preserve all existing staged/unstaged changes.
- Avoid unrelated UI redesign during backend/API bug fixes.
- Do not move components as part of unrelated work unless requested and imports/tests are covered.
- Run the narrowest relevant check, then broader checks where time allows. Report exactly what passed and what was not tested.
- Keep engineering documentation in `docs/`. Keep root `GEMINI.md` and scoped `AGENTS.md` files where coding tools expect to discover them.

## Architecture roadmap vs current implementation

Kafka/Redpanda, Tile38, multi-region clusters, Go/Rust ingestion, Protobuf and million-user sizing appear in the [scalability report](scalability-report.md) as possible future directions. They are not requirements to introduce those components without a concrete scale need and a measured migration plan.
