# Web Frontend Guide

## Overview

The web frontend in `frontend/` is a React/Vite single-page application for passenger and driver experiences, profiles, trip/route discovery, tracking, notifications, and shared/admin-facing modules. It uses Redux Toolkit/React Redux, Axios, React Router, MapLibre, Tailwind-related utilities and animation libraries.

## Source layout

- `src/app/` — app bootstrap/provider setup.
- `src/routes/` — route configuration and guards.
- `src/pages/` — route-level screens.
- `src/passenger/`, `src/driver/` — passenger and driver workflows.
- `src/features/` — domain-oriented feature modules (auth, driver, passenger, profile, verification).
- `src/redux/` — store, slices and API state.
- `src/services/api/` — API services.
- `src/services/routes/` — route services/normalizers.
- `src/services/sockets/`, `src/sockets/` — WebSocket lifecycle and event wiring.
- `src/maps/`, `src/components/map/`, `src/tracking/` — map and live tracking UI.
- `src/components/`, `src/components/ui/` — shared and legacy components.
- `src/config/`, `src/constants/`, `src/utils/` — configuration and helpers.
- `public/` — static assets such as fonts/models.
- `scripts/` — project-specific contract/normalizer checks.

The repository has both newer feature-oriented folders and older shared/component folders. Treat this as an in-progress migration: follow existing imports and tests rather than moving files based only on folder names.

## Important workflows

- Authentication and role-aware route guards.
- Passenger and driver profiles.
- Route discovery, route previews, trips and tracking.
- Driver/passenger live maps and WebSocket updates.
- Notifications, help/support and policy pages.
- Verification/profile workflows.

## API and real-time integration

Use centralized API clients/services rather than building endpoint URLs independently in components. The backend API families are documented in [API reference](../backend/api-reference.md). Route normalizers should accept only the response shapes explicitly supported by contract checks. GeoJSON route coordinates are `[longitude, latitude]`; map APIs may require conversion to their own coordinate representation.

Keep WebSocket connection/reconnection logic centralized in the socket manager. Avoid creating duplicate socket connections inside frequently rendered components, and clean up subscriptions on unmount.

## Local development

```bash
cd frontend
npm install
npm run dev
```

## Quality checks

```bash
npm run build
npm run lint
npm run check:normalizer
npm run preview
```

The normalizer check is a project-specific contract check; it does not replace integration tests against a running backend.

## Architecture and migration

The [frontend architecture note](architecture.md) records the intended folder ownership and migration rules. The intent is to keep current behavior stable while gradually moving code into clearer domain modules. Do not change UI or move a component as part of unrelated API fixes unless the task explicitly asks for a UI change.

## Configuration and deployment

Inspect `vite.config.*`, environment examples, Compose and Nginx configuration to confirm the API proxy and production mount path. Do not assume the frontend and admin SPA share the same base path or deploy artifact. Test deep links and refreshes after routing/proxy changes.
