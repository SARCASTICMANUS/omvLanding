# VAYY Mobile App Guide

## Overview

`vayy_app/` is the Expo/React Native application for Android and iOS, with a web target available through Expo. Current package metadata identifies Expo SDK 54, React Native 0.81 and React 19. MapLibre Native is used for native maps and MapLibre GL JS/react-map-gl supports web map rendering.

## Source layout

- `src/navigation/` — app, auth, passenger and driver navigators.
- `src/auth/` — authentication screens and components.
- `src/passenger/` — passenger home, route planning, shared-auto and bike-ride workflows.
- `src/driver/` — driver home, bike ride and shared-auto workflows, screens, services and hooks.
- `src/routes/` — route data/services, normalizers, components and route screens.
- `src/tracking/` — tracking screens and related logic.
- `src/handshake/` — passenger/driver handshake and verification screens.
- `src/shared/` — reusable components, API clients, search history, constants, hooks, types and utilities.
- `src/store/` — Redux store and slices.
- `src/admin/` — mobile-accessible admin-related screens/components/services where used.
- `src/theme/`, `src/constants/`, `src/utils/` — theme, app constants and helpers.
- `assets/` — application assets and user-facing policy content.
- `android/` — native Android project used for native module builds.

## Navigation and user journeys

The app separates auth, passenger and driver navigation. The exact stack and screen registration live in `src/navigation/`; screen names should be changed in sync with navigation calls. Product context is documented in [product context](product-context.md).

Primary product concepts:
- Passengers choose pickup/destination, inspect routes or available vehicles, request a pickup/raise-hand, verify boarding, and track the ride.
- Drivers choose a mobility mode, set/confirm route locations, discover matching passengers, manage pickup and trip state, and share location while active.
- Auto and bike flows share infrastructure but have different screens and lifecycle details.

## Location search and route preview

Location search should use registered backend geocoding endpoints under `/api/transport/geocode/`. Dynamic route previews use `POST /api/transport/routes/dynamic-preview/`. Recent searches are served by `/api/accounts/recent-searches/`. The client should normalize server response envelopes in service/normalizer layers, not in every screen.

Important coordinate rules:
- Use explicit numeric checks rather than truthiness to validate coordinates.
- Clear a selected coordinate when the user edits its visible place name; otherwise the text can disagree with the coordinate sent to the API.
- GeoJSON line coordinates are ordered `[longitude, latitude]`.
- Route preview errors should log the HTTP status and safe response message during development, without logging tokens or personal data.

## Maps

Map selection and style loading are handled in the shared map components, with native and web implementations. Keep the map style source valid for MapLibre and preserve attribution. API keys should be read from environment/configuration and must not be committed. Public map services have usage limits; verify terms and rate limits before production use.

## Local development

```bash
cd vayy_app
npm install
npx expo start
npx expo start --android
npx expo start --ios
npx expo start --web
```

## Quality checks and build

```bash
npx expo lint
npx expo export --platform android --output-dir /tmp/vayy-app-export-check
```

An Expo export validates bundling; it does not prove native modules work on a device. Test map rendering, location permissions, API connectivity, OTP/KYC, push notifications, deep links and background tracking on an emulator/device. Native MapLibre and push-notification configuration may require an EAS/native build rather than Expo Go.

## Environment and API base URL

The app reads public build-time settings such as `EXPO_PUBLIC_API_URL` and map-related public keys. Use the project's `.env.example` as the safe variable-name reference. For Android emulator networking, `localhost` inside the emulator points to the emulator itself; a host-mapped address such as `10.0.2.2` is often required when the backend runs on the development host. Use the correct reachable base URL for the actual environment.

## Known issues and audit notes

See [migration debt](migration-debt.md) for previously investigated defects/fixes and [bike flow audit](bike-flow-audit.md) for workflow gaps. These are audit snapshots; verify each finding against current code before reopening or declaring it resolved.
