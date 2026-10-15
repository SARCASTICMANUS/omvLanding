# Backend API Reference

This is a route-group index derived from the URL configuration. For exact request/response schemas, use the running OpenAPI document at `/api/schema/` or Swagger UI at `/api/docs/`.

## Global endpoints

| Method/path | Purpose |
|---|---|
| `GET /healthz/` | Basic service health response |
| `GET /api/schema/` | OpenAPI schema |
| `GET /api/docs/` | Swagger UI |
| `GET /api/redoc/` | ReDoc UI |
| `/django-admin/` | Django admin site |

## Accounts — `/api/accounts/`

- Authentication/onboarding: `register/`, `send-registration-otp/`, `verify-and-register/`, `resend-registration-otp/`, `complete-registration/`, `login/`, `verify-otp/`, `resend-otp/`.
- Passwords/tokens: `forgot-password/`, `reset-password/`, `change-password/`, `token/refresh/`.
- Current user/profile: `me/`, `me/passenger-profile/`, `me/driver-profile/`.
- Wallet/payment: `wallet/`, `wallet/orders/`, `wallet/webhook/`, `wallet/add-funds/`.
- Driver KYC: `driver/documents/`, `driver/documents/{doc_id}/`, `driver/bank-details/`, `verification-status/`.
- Search/push: `recent-searches/`, `push-token/`.
- User router: `users/` (including role-filtered lists where supported).

## Transport — `/api/transport/`

- Geocoding: `geocode/search/`, `geocode/db/search/`, `geocode/reverse/`.
- Route discovery: `driver/routes/`, `routes/search-by-location/`, `routes/preview/`, `routes/dynamic-preview/`, `routes/dynamic-generate/`, `routes/{route_id}/geometry/`, `routes/{route_id}/schedule/`, `routes/{route_id}/nearby-passengers/`, `routes/code/{route_code}/`, `routes/bus/{bus_number}/`.
- Stops: `stops/nearby/`, `global-stops/nearby/`, `stops/{stop_id}/eta/`.
- Routing helpers: `road-distance/`, `walking-path/`.
- Standard routers: `cities/`, `routes/`, `stops/`, `schedules/`, `stop-times/`.
- Admin operations: `admin/onboarding/`, `admin/stops/summary/`, `admin/routes/`, `admin/stops/`, `admin/schedules/`, `admin/stop-times/`, `admin/cities/`, `admin/stops-bulk/`, `admin/route-import/`.

### Dynamic route preview example

The preview API is registered as `POST /api/transport/routes/dynamic-preview/`. A typical client payload includes `origin` and `destination` coordinates, and may include `city_id` and `vehicle_type`. Verify required fields against the serializer in the current branch. Route geometry uses GeoJSON coordinate order `[longitude, latitude]`.

## Operations — `/api/operations/`

- Vehicles: `vehicles/`, `vehicles/me/`, `vehicles/{vehicle_id}/`, `vehicles/{vehicle_id}/state/`, `vehicles/register/`.
- Trips: `trips/`, `trips/start/`, `trips/me/active/`, `trips/{trip_id}/`, `trips/{trip_id}/next-stops/`, `trips/{trip_id}/boarding-requests/`.
- Boarding requests: `boarding-requests/`, `boarding-requests/{request_id}/`, `boarding-requests/{request_id}/boarded/`.
- Dispatch: `dispatch/request/`, `dispatch/assign/`, `dispatch/{trip_id}/`, and accept/reject/arrived/start/complete/cancel actions.
- Broadcast dispatch: `dispatch/broadcast/{request_id}/accept/`, `reject/`, `cancel/`.
- Admin verification: `admin/drivers/pending/`, `admin/drivers/{driver_id}/verify/`, `admin/documents/{doc_id}/verify/`, `admin/documents/{doc_id}/file/`.
- Fare configuration: `fare-configurations/`, `fare-configurations/quote/`.

## Tracking — `/api/tracking/`

- Ingestion: `gps/`, `ingest/`.
- Tracking: `nearby/`, `vehicle/{vehicle_id}/`, `trip/{trip_id}/`, `passenger-location/`, `driver-location/`.
- Route trips and journeys: `start-route-trip/`, `end-route-trip/`, `journeys/start/`, `journeys/preview/`, `journeys/active/`, `journeys/end/`, `journeys/{trip_id}/`.
- Discovery and ride lifecycle: `raise-hand/`, `corridor/vehicles/`, `stops/{stop_id}/passing-vehicles/`, `ride-lifecycle/`, `route/{route_id}/stops/`, `route/{route_id}/active-trips/`, `nearby-routes/`.

## Communication — `/api/communication/`

- `waitlist/`
- `notifications/`, `notifications/read-all/`, `notifications/{notification_id}/read/`, `notifications/{notification_id}/`
- `preferences/`

## KPI — `/api/kpi/`

- `track/`
- `overview/`
- `snapshots/`
- `admin-stats/`
- `geo-stats/`

## Contract and integration notes

1. Normalize API envelope shapes at service boundaries; don't let each screen guess whether a response is an array, `data`, or `results`.
2. Keep mobile and web base URLs environment-configured. Android emulators commonly need a host-reachable API address, not the emulator's own loopback.
3. Use authenticated test accounts and synthetic test data for integration checks.
4. Treat the OpenAPI schema and implementation as authoritative when this summary and the source differ.
