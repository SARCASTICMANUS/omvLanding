# Admin Console Guide

## Overview

The admin console is a standalone React/Vite app in `admin/`. It uses React Router, Axios, MapLibre, Tailwind CSS and lazy-loaded pages. The current console's authenticated shell includes Dashboard, KPI & Analytics, Dynamic Routing, Fixed Routing, Drivers and Users.

The app labels its shell “OMV Admin” in current UI source, while the repository/project is VAYY. This document refers to the directory as the admin console and does not assume that branding has already been normalized.

## Key files

- `src/main.jsx` — React entry point.
- `src/App.jsx` — route/authentication bootstrap and admin shell.
- `src/api/client.js` — Axios client and API base configuration.
- `src/constants/paths.js` — mount prefix and console route constants.
- `src/components/Sidebar.jsx` — navigation.
- `src/components/PageToolbar.jsx`, `Loader.jsx`, `EmptyState.jsx` — shared UI.
- `src/pages/` — dashboard, users, driver verification, dynamic/fixed routing, cities/stops/routes/schedules/fares and KPI pages.
- `src/components/geo/` — geographic visualizations and map layers.

## Main modules

| UI area | Purpose |
|---|---|
| Dashboard | High-level operational summary |
| KPI & Analytics | Platform and geographic analytics |
| Dynamic Routing | City configuration, dynamic routes and supporting stop/fare setup |
| Fixed Routing | Fixed network exploration and management: cities, routes, stops, schedules and fare configuration |
| Drivers | Driver onboarding and document verification |
| Users | Passenger and driver directory |
| Landing/Support | Public/auxiliary screens included in the SPA |

Some older page files remain in the source tree but are not top-level tabs. Check `App.jsx` and `FixedRouting.jsx` before assuming a page is directly navigable.

## Authentication

The current app checks `localStorage.admin_token`, requests `/accounts/me/`, and only accepts a user whose role is `admin` or who is marked `is_staff`. Logout removes `admin_token` and `admin_refresh`. Authentication and authorization must still be enforced by backend permissions; local storage and client guards alone are not security boundaries.

The console mount path is controlled by `src/constants/paths.js` and Vite/Nginx configuration. Keep the browser-router paths and Nginx prefix aligned to avoid doubled prefixes or broken refreshes on nested paths.

## Local development

```bash
cd admin
npm install
npm run dev
```

## Build and lint

```bash
npm run build
npm run lint
npm run preview
```

## API and environment

The Axios client is centralized in `src/api/client.js`. Check that file and the Vite environment configuration to determine the actual API base URL. Never commit API tokens or production environment values. When changing response shapes, update the page/service normalization and the backend contract together.

## Admin verification workflow

The Drivers page consumes backend operations/account APIs for pending drivers and document review. A driver should only appear fully verified after all required KYC documents are accepted by backend business logic. The account-level OTP verification flag is distinct from document/KYC verification. Use the backend's verification-status contract for status labels and gating rather than inferring verification from a single boolean.

## Maintenance checklist

- Test direct page refreshes beneath the configured mount prefix.
- Confirm expired/invalid tokens return to the login flow.
- Verify admin permissions on server-side endpoints.
- Check loading, empty and error states for API-backed tables.
- Run build and lint; treat lint warnings/errors separately from a successful build.
