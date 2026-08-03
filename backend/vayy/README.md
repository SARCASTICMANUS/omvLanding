# VAYY Backend

Django REST backend for the VAYY route-based mobility platform. Handles auth, dispatch, tracking, transport, payments, and real-time communication for Passenger, Bike Driver, Auto Driver, and Admin roles.

---

## Tech Stack

| Component | Technology |
|---|---|
| Framework | Django 6.0.6 + Django REST Framework 3.17.1 |
| Language | Python 3.12 |
| Database | PostgreSQL + PostGIS (GIS fields, geography columns) |
| Cache / Channel Layers | Redis 7 (Django cache + Channels channel layer) |
| Message Broker | RabbitMQ 3.13 (6 topic/direct exchanges, dead-letter queues) |
| Task Queue | Celery 5.6.3 (queues: `celery`, `tracking`, `dispatch`, `matching`) |
| ASGI / WebSockets | Daphne + Django Channels 4.2.0 |
| Routing Engine | OSRM (Docker, MLD algorithm, pre-processed in `osrm/`) |
| API Docs | drf-spectacular + sidecar (Swagger / ReDoc) |
| Auth | SimpleJWT (access 2 days, refresh 7 days, rotation enabled) |
| Spatial Queries | Django GIS (PostGIS) + Redis GEO for nearby vehicle lookups |

---

## Project Structure

```
vayy/
├── vayy/                    # Django project settings
│   ├── settings.py          # All configuration (env-based)
│   ├── urls.py              # Root URL routing
│   ├── asgi.py              # ASGI + combined WebSocket routing
│   ├── wsgi.py              # WSGI entry point
│   └── celery.py            # Celery app configuration
│
├── accounts/                # User auth, profiles, wallet, KYC
│   ├── models.py            # User, PublicPassengerProfile, PublicDriverProfile, Wallet, Transaction, PaymentMethod, DriverDocument, RecentSearch
│   ├── managers.py          # Custom UserManager
│   ├── permissions.py       # IsDriver, IsPassenger
│   ├── api/
│   │   ├── views.py         # Auth, profile, wallet, KYC, push-token, UserViewSet
│   │   ├── urls.py          # /api/accounts/* endpoints
│   │   └── serializers.py   # Request/response serializers
│   └── services/
│       ├── auth_service.py          # OTP-based auth flow
│       ├── otp_service.py           # OTP generation/validation
│       ├── verification_service.py  # KYC / account verification
│       └── wallet_service.py        # Add/deduct/transfer funds
│
├── transport/               # Cities, routes, stops, schedules
│   ├── models.py            # City, Route, Stop, TripSchedule, StopTime
│   ├── constants.py         # Route visibility choices
│   ├── api/
│   │   ├── views.py         # CRUD + nearby stops, ETA, geometry, road distance
│   │   ├── admin_views.py   # Admin route/stop management
│   │   ├── admin_urls.py    # /api/admin/* endpoints
│   │   ├── urls.py          # /api/transport/* endpoints
│   │   └── serializers.py
│   ├── selectors/
│   │   ├── city_selector.py
│   │   ├── route_selector.py
│   │   └── driver_route_selector.py
│   ├── services/
│   │   ├── osrm_service.py      # OSRM route / matrix / distance / duration
│   │   ├── route_service.py     # Route queries + OSRM distance recalc
│   │   └── geocoding_service.py # Nominatim reverse geocoding
│   └── management/commands/
│       └── create_test_passengers.py  # Seed dummy passengers near stops
│
├── operations/              # Vehicles, trips, dispatch, boarding
│   ├── models.py            # Vehicle, ActiveTrip, TripRating, VehicleState, BoardingRequest, DispatchRequest
│   ├── constants.py         # Trip/boarding statuses, dispatch modes
│   ├── exceptions.py        # Custom exceptions
│   ├── api/
│   │   ├── views.py         # Dispatch lifecycle, vehicles, trips, boarding, broadcast
│   │   ├── urls.py          # /api/operations/* endpoints
│   │   ├── ride_urls.py     # /api/ride/* endpoints (estimate, rating, history, earnings, fare)
│   │   └── serializers.py
│   ├── selectors/
│   │   ├── trip_selector.py
│   │   ├── vehicle_selector.py
│   │   └── boarding_selector.py
│   ├── services/
│   │   ├── dispatch_service.py   # Matching engine, dispatch state machine, settlement
│   │   ├── trip_service.py       # Trip start/complete
│   │   ├── boarding_service.py   # Boarding request lifecycle
│   │   ├── vehicle_service.py    # Vehicle management
│   │   ├── ride_service.py       # Fare calculation, nearby vehicles
│   │   └── rating_service.py     # Trip rating
│   ├── consumers/
│   │   └── dispatch_consumer.py  # RabbitMQ dispatch/assignment handler
│   ├── websockets/
│   │   ├── routing.py       # ws/dispatch/<id>/, ws/dispatch/broadcast/<id>/
│   │   └── consumers.py     # DispatchStatusConsumer, DispatchBroadcastConsumer
│   ├── management/commands/
│   │   └── consume_boarding.py   # RabbitMQ → Celery boarding consumer
│   └── tasks.py             # Celery tasks (assignment timeout, dispatch, boarding)
│
├── tracking/                # GPS ingestion, location tracking, matching
│   ├── models.py            # HybridLog (GPS + cell towers + WiFi)
│   ├── constants.py         # Tracking routing keys
│   ├── api/
│   │   ├── views.py         # GPS ingest, nearby vehicles, route trips, ride lifecycle
│   │   ├── urls.py          # /api/tracking/* endpoints
│   │   └── serializers.py
│   ├── selectors/
│   │   └── hybrid_selector.py
│   ├── services/
│   │   ├── gps_service.py       # Raw GPS ingestion into HybridLog
│   │   ├── location_service.py  # Core GPS processing pipeline (snap, ETA, Redis, WS)
│   │   ├── matching_service.py  # Multi-stage ride matching + lifecycle
│   │   ├── redis_geo_service.py # Redis GEOADD / GEORADIUS nearby vehicles
│   │   ├── redis_route_service.py # Redis route-state cache + ride requests
│   │   ├── eta_service.py       # OSRM + haversine ETA calculation
│   │   ├── geo_service.py       # Spatial query helpers
│   │   └── event_publisher.py   # Publish tracking events to RabbitMQ
│   ├── consumers/
│   │   ├── gps_consumer.py      # Raw GPS event handler
│   │   └── location_consumer.py # Location update handler
│   ├── websockets/
│   │   ├── routing.py       # ws/tracking/vehicle|trip|route|route-passengers|ride-requests
│   │   └── consumers.py     # Vehicle, Trip, Route, RoutePassenger, RideRequest consumers
│   ├── management/commands/
│   │   └── consume_location.py  # RabbitMQ location consumer → Celery
│   └── tasks.py             # Celery tasks (location, GPS, matching, ride lifecycle)
│
├── communication/           # Notifications, email, SMS, push
│   ├── models.py            # Notification, NotificationPreference
│   ├── constants.py         # Notification types, RabbitMQ exchanges/queues/keys
│   ├── api/
│   │   ├── views.py         # Notification CRUD, read-all, preferences
│   │   ├── urls.py          # /api/communication/* endpoints
│   │   └── serializers.py
│   ├── selectors/
│   │   └── notification_selector.py
│   ├── services/
│   │   ├── notification_service.py  # Create & dispatch notifications
│   │   ├── push_service.py          # Push notifications
│   │   ├── email_service.py         # Email sending
│   │   ├── sms_service.py           # SMS sending
│   │   └── rabbitmq_service.py      # Singleton pika channel, publish, infra setup
│   ├── consumers/
│   │   └── notification_consumer.py # Routes notifications to delivery services
│   ├── websockets/
│   │   ├── routing.py       # ws/notifications/<user_id>/
│   │   └── consumers.py     # NotificationConsumer
│   └── tasks.py             # Celery tasks (notification dispatch)
│
├── common/                  # Shared utilities
│   ├── middleware.py         # CorrelationIDMiddleware, RequestResponseLoggingMiddleware
│   ├── constants.py         # ROLE_CHOICES, VEHICLE_TYPE_CHOICES, TX/DOC choices
│   ├── responses.py         # success_response() / error_response()
│   └── websockets/
│       └── auth.py          # BaseAuthenticatedConsumer (JWT WebSocket auth)
│
├── tests/                   # Test suite
│   ├── test_dispatch.py
│   ├── test_ride_experience.py
│   └── test_driver_lifecycle.py
│
├── scripts/                 # Simulation scripts
│   ├── route_gps_simulator.py
│   ├── driver_gps_simulator.py
│   └── driver_gps_rabbitmq_simulator.py
│
├── osrm/                    # Pre-processed OSRM map data (.osrm files)
├── nginx/                   # Nginx reverse proxy config
├── staticfiles/             # Collected static files
├── manage.py
├── requirements.txt         # Pinned dependencies
├── Dockerfile
├── docker-compose.yaml
├── entrypoint.sh            # Wait for PG → migrate → collectstatic → createsuperuser → Daphne
└── .env
```

---

## API Endpoints

All responses are wrapped in `{ success, message, data }`. Endpoints require JWT auth unless noted.

### Accounts (`/api/accounts/`)

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| GET/POST | `users/` | Yes | User list / create (UserViewSet) |
| POST | `register/` | No | Register user, sends OTP |
| POST | `login/` | No | Login, returns JWT tokens |
| POST | `verify-otp/` | No | Verify registration OTP |
| POST | `resend-otp/` | No | Resend OTP |
| POST | `forgot-password/` | No | Request password reset |
| POST | `reset-password/` | No | Reset password |
| POST | `change-password/` | Yes | Change password |
| POST | `token/refresh/` | No | Refresh JWT access token |
| GET | `me/` | Yes | Get current user |
| GET/PUT | `me/passenger-profile/` | Yes | Passenger profile |
| GET/PUT | `me/driver-profile/` | Yes | Driver profile |
| GET | `wallet/` | Yes | Wallet balance |
| POST | `wallet/add-funds/` | Yes | Add funds |
| POST | `driver/documents/` | Yes | Upload KYC (LICENSE, RC, INSURANCE, IDENTITY) |
| GET/POST | `recent-searches/` | Yes | Recent search history |
| POST | `push-token/` | Yes | Register Expo push token |

### Transport (`/api/transport/`)

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| GET/POST | `cities/` | Yes | City CRUD |
| GET/POST | `routes/` | Yes | Route CRUD |
| GET/POST | `stops/` | Yes | Stop CRUD |
| GET/POST | `schedules/` | Yes | Trip schedule CRUD |
| GET/POST | `stop-times/` | Yes | StopTime CRUD |
| GET | `driver/routes/` | Yes | Routes assigned to driver |
| GET | `routes/search-by-location/` | Yes | Search routes by lat/lng |
| GET | `routes/preview/` | Yes | Route preview |
| GET | `routes/<id>/nearby-passengers/` | Yes | Passengers along route |
| GET | `routes/<id>/geometry/` | Yes | Route geometry (GeoJSON LineString) |
| GET | `routes/<id>/schedule/` | Yes | Route schedule with stop times |
| GET | `routes/code/<route_code>/` | Yes | Route by route code |
| GET | `stops/nearby/` | Yes | Nearby stops (PostGIS) |
| GET | `stops/<id>/eta/` | Yes | ETA to stop |
| GET | `road-distance/` | Yes | Road distance between two points |

### Admin (`/api/admin/`)

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| GET/POST | `routes/` | Admin | Admin route management (AdminRouteViewSet) |
| GET/POST | `stops/` | Admin | Admin stop management (AdminStopViewSet) |

### Operations (`/api/operations/`)

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| GET | `vehicles/` | Yes | List vehicles (by city/route) |
| GET | `vehicles/me/` | Driver | Driver's assigned vehicle |
| GET | `vehicles/<id>/` | Yes | Vehicle detail |
| GET | `vehicles/<id>/state/` | Yes | Vehicle runtime state |
| GET | `trips/` | Yes | List active trips |
| GET | `trips/start/` | Driver | Start a trip |
| GET | `trips/me/active/` | Driver | Driver's active trip |
| GET | `trips/<id>/` | Yes | Trip detail |
| GET | `trips/<id>/next-stops/` | Yes | Next stops for trip |
| GET | `trips/<id>/boarding-requests/` | Driver | Boarding requests for trip |
| GET/POST | `boarding-requests/` | Passenger | List/create boarding requests |
| GET/DELETE | `boarding-requests/<id>/` | Yes | Boarding request detail/cancel |
| POST | `boarding-requests/<id>/boarded/` | Driver | Mark passenger boarded |

### Dispatch (`/api/operations/dispatch/`)

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| POST | `request/` | Passenger | Request dispatch (triggers matching) |
| POST | `assign/` | Admin | Assign driver to route |
| GET | `<id>/` | Yes | Dispatch detail |
| PATCH | `<id>/accept/` | Driver | Accept assignment |
| PATCH | `<id>/reject/` | Driver | Reject assignment |
| PATCH | `<id>/arrived/` | Driver | Arrived at pickup |
| PATCH | `<id>/start/` | Driver | Start trip |
| PATCH | `<id>/complete/` | Driver | Complete trip |
| PATCH | `<id>/cancel/` | Yes | Cancel dispatch |
| POST | `broadcast/<id>/accept/` | Driver | Accept broadcast dispatch |
| POST | `broadcast/<id>/reject/` | Driver | Reject broadcast dispatch |
| POST | `broadcast/<id>/cancel/` | Yes | Cancel broadcast dispatch |

### Ride (`/api/ride/`)

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| POST | `estimate/` | Passenger | Get fare estimate |
| POST | `rating/` | Passenger | Rate completed trip |
| GET | `history/` | Yes | Trip history (paginated) |
| GET | `earnings/` | Driver | Driver earnings (today/week/month/all) |
| GET | `trip/<id>/fare/` | Yes | Trip fare detail |

### Tracking (`/api/tracking/`)

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| POST | `gps/` | Driver | GPS data ingestion |
| POST | `ingest/` | Driver | Telemetry ingestion (location pipeline) |
| GET | `nearby/` | Yes | Nearby vehicles (Redis GEO / PostGIS) |
| GET | `vehicle/<id>/` | Yes | Vehicle location history |
| GET | `trip/<id>/` | Yes | Trip location history |
| POST | `passenger-location/` | Passenger | Update passenger location |
| POST | `driver-location/` | Driver | Update driver location |
| POST | `start-route-trip/` | Driver | Start a route-based trip |
| POST | `end-route-trip/` | Driver | End a route-based trip |
| POST | `raise-hand/` | Passenger | Passenger raises hand to board (ride request) |
| POST | `ride-lifecycle/` | Yes | Ride lifecycle transitions (accept/reject/board/complete) |
| GET | `route/<id>/stops/` | Yes | Stops for a route |
| GET | `route/<id>/active-trips/` | Yes | Active trips on a route |
| GET | `nearby-routes/` | Yes | Nearby routes |

### Communication (`/api/communication/`)

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| GET | `notifications/` | Yes | List notifications |
| PATCH | `notifications/<id>/read/` | Yes | Mark as read |
| PATCH | `notifications/read-all/` | Yes | Mark all as read |
| DELETE | `notifications/<id>/` | Yes | Delete notification |
| GET/PUT | `preferences/` | Yes | Notification preferences |

---

## WebSocket Endpoints

All consumers authenticate with JWT via `BaseAuthenticatedConsumer` (token passed as `?token=` query param; close code `4001` on invalid).

| Endpoint | Consumer | Purpose |
|---|---|---|
| `ws/tracking/vehicle/<uuid>/` | `VehicleTrackingConsumer` | Driver sends GPS → Celery → broadcast to passengers |
| `ws/tracking/trip/<uuid>/` | `TripTrackingConsumer` | Passenger receives live vehicle position |
| `ws/tracking/route/<uuid>/` | `RouteTrackingConsumer` | Live vehicles on a route |
| `ws/tracking/route-passengers/<uuid>/` | `RoutePassengerTrackingConsumer` | Driver sees passengers along route |
| `ws/tracking/ride-requests/` | `RideRequestConsumer` | Passenger ride-request / match updates |
| `ws/dispatch/<uuid>/` | `DispatchStatusConsumer` | Dispatch status updates (accept/reject/arrived/complete) |
| `ws/dispatch/broadcast/<uuid>/` | `DispatchBroadcastConsumer` | Broadcast dispatch updates (driver accepted, expired, no drivers) |
| `ws/notifications/<str:user_id>/` | `NotificationConsumer` | Push notifications to user |

---

## Dispatch State Machine

```
                    ┌──────────┐
                    │ ASSIGNED │
                    └────┬─────┘
                         │
              ┌──────────┼──────────┐
              ▼          ▼          ▼
         ┌─────────┐ ┌─────────┐ ┌───────────┐
         │ACCEPTED │ │REJECTED │ │ CANCELLED │
         └────┬────┘ └─────────┘ └───────────┘
              │
              ▼
         ┌─────────┐
         │ ARRIVED │
         └────┬────┘
              │
              ▼
         ┌────────┐
         │ ACTIVE │
         └────┬───┘
              │
         ┌────┼──────────┐
         ▼              ▼
    ┌───────────┐  ┌───────────┐
    │ COMPLETED │  │ CANCELLED │
    └───────────┘  └───────────┘
```

Valid transitions enforced by `DispatchService.update_trip_status()`:
- `ASSIGNED` → `ACCEPTED` / `REJECTED` / `CANCELLED`
- `ACCEPTED` → `ARRIVED` / `CANCELLED`
- `ARRIVED` → `ACTIVE` / `CANCELLED`
- `ACTIVE` → `COMPLETED` / `CANCELLED`

On `COMPLETED`: `_process_trip_settlement()` runs fare calculation, wallet transfer per boarded passenger, and a "Ride Completed" notification.

In addition, `DispatchRequest` supports a broadcast mode with its own lifecycle: `pending` → `accepted` / `cancelled` / `expired`. `BroadcastAccept/Reject/Cancel` views drive these transitions, and `expire_broadcast_request` (Celery) expires pending requests after ~90s.

---

## Real-Time Data Pipeline

```
Driver App (WS or HTTP)
  → VehicleTrackingConsumer.receive() / GPSIngestAPIView
    → Celery task process_location_update
      → LocationService.process_location_update()
        → DB update (VehicleState, HybridLog)
        → OSRM snap-to-route + ETA computation
        → Redis GEO set (nearby vehicle queries)
        → Redis route state (route-based vehicle tracking)
        → WebSocket broadcast (vehicle_*, trip_*, route_* groups)
  → Passenger App receives vehicle_update
```

RabbitMQ bridges async work: location events flow through `location.topic` into `auto.location` / `bike.location` / `passenger.location`, consumed by the `consume_location` management command, which dispatches Celery tasks. Boarding events flow through `boarding.events` → `boarding.requests`, consumed by `consume_boarding`.

---

## Matching Engine

Two complementary matching paths exist:

**1. `DispatchService.find_best_candidates()`** — ranks drivers by a weighted score:
1. **Distance** (max 50 pts) — road distance via OSRM matrix
2. **Rating** (max 30 pts) — driver profile rating × 6
3. **Occupancy** (max 10 pts) — lower occupancy = higher score
4. **Route compatibility** (max 10 pts) — city match

**2. `MatchingService.find_and_match_driver()`** — multi-stage matching used by ride requests (`raise-hand`):
1. Get vehicles on route from Redis (DB fallback)
2. Filter by direction (outbound/inbound derived from stop order)
3. Validate stop sequence (driver at or before pickup)
4. Proximity filter (max 5km from pickup)
5. Rank by ETA to pickup, then distance
6. Publish ride request to the matched driver's queue (`dispatch.<vehicle_id>`)

Ride lifecycle (accept/reject/board/complete) is processed by `process_ride_lifecycle` Celery tasks, which update `BoardingRequest` status and vehicle occupancy.

---

## Payment Flow

On trip completion (`COMPLETED` status):

1. `RideService.calculate_final_fare()` computes fare based on route distance (auto: ₹30 base + ₹10/km, bike: ₹20 base + ₹5/km)
2. `DispatchService._process_trip_settlement()` transfers fare per boarded passenger via `WalletService.transfer_funds()` (debit passenger → credit driver)
3. `NotificationService.create()` sends "Ride Completed" notification to the passenger

---

## Infrastructure (Docker)

Services defined in `docker-compose.yaml`:

| Service | Image | Port | Purpose |
|---|---|---|---|
| `web` | Custom Django | 8000 | Daphne ASGI (REST API + WebSockets) |
| `celery` | Custom Django | — | Celery worker (`celery,tracking,dispatch` queues) + `consume_boarding` + `consume_location` |
| `redis` | `redis:7-alpine` | 6379 | Cache + Channel Layers |
| `rabbitmq` | `rabbitmq:3.13-management` | 5672 / 15672 | Message broker + management UI |
| `osrm` | `osrm/osrm-backend:latest` | 5000 | Routing engine (extracts map on first boot) |
| `nginx` | `nginx:alpine` | 80 / 443 | Reverse proxy (serves static/media) |
| `ngrok` | `ngrok/ngrok:latest` | 4040 | Public tunnel to `web:8000` |
| `redisinsight` | `redis/redisinsight:latest` | 5540 | Redis GUI |

```bash
# Start all services
docker-compose up -d --build

# View logs
docker-compose logs -f web

# Run migrations
docker-compose exec web python manage.py migrate

# Create superuser
docker-compose exec web python manage.py createsuperuser

# Run simulation scripts
docker-compose exec web python scripts/route_gps_simulator.py \
  --api-url http://localhost:8000 \
  --email driver@gmail.com \
  --password zxcv9876 \
  --vehicle-id <UUID> \
  --route-id <UUID> \
  --duration 600
```

---

## Environment Variables

Required in `.env`:

```env
SECRET_KEY=your-secret-key
DEBUG=true
ALLOWED_HOSTS=*
DATABASE_URL=postgis://postgres:password@localhost:5432/vayy
REDIS_URL=redis://localhost:6379/0
CELERY_BROKER_URL=amqp://admin:admin123@localhost:5672/
RABBITMQ_URL=amqp://admin:admin123@localhost:5672/
RABBITMQ_HOST=localhost
RABBITMQ_PORT=5672
RABBITMQ_USER=admin
RABBITMQ_PASSWORD=admin123
OSRM_URL=http://localhost:5000
EMAIL_HOST=smtp.example.com
EMAIL_PORT=587
EMAIL_HOST_USER=your-email
EMAIL_HOST_PASSWORD=your-password
EMAIL_USE_TLS=true
DEFAULT_FROM_EMAIL=noreply@vayy.com
CORS_ALLOW_ALL_ORIGINS=true
CSRF_TRUSTED_ORIGINS=
GDAL_LIBRARY_PATH=/usr/lib/aarch64-linux-gnu/libgdal.so
GEOS_LIBRARY_PATH=/usr/lib/aarch64-linux-gnu/libgeos_c.so
```

---

## Development

```bash
# Install dependencies
pip install -r requirements.txt

# Run migrations
python manage.py migrate

# Run API (WSGI only, no WebSockets)
python manage.py runserver

# Run ASGI server (REST + WebSockets) — recommended
daphne -b 0.0.0.0 -p 8000 vayy.asgi:application

# Run Celery worker (queues: celery, tracking, dispatch, matching)
celery -A vayy worker -l info -Q celery,tracking,dispatch

# Run Celery beat (periodic tasks)
celery -A vayy beat -l info

# Run RabbitMQ boarding consumer
python manage.py consume_boarding

# Run RabbitMQ location consumer
python manage.py consume_location

# Seed dummy passengers near route stops
python manage.py create_test_passengers

# Run tests
python manage.py test
# or
pytest backend/vayy/tests/

# Generate API schema
python manage.py spectacular --color --file schema.yml
```

### Simulation Scripts

```bash
# Route-based GPS simulator (follows real route geometry)
python3 scripts/route_gps_simulator.py \
  --api-url http://localhost:8000 \
  --email driver@gmail.com \
  --password zxcv9876 \
  --vehicle-id <UUID> \
  --route-id <UUID> \
  --duration 600

# Simple GPS simulator
python3 scripts/driver_gps_simulator.py \
  --api-url http://localhost:8000 \
  --email driver@gmail.com \
  --password Test@1234 \
  --vehicle-id <UUID>

# GPS simulator through the RabbitMQ pipeline
python3 scripts/driver_gps_rabbitmq_simulator.py \
  --api-url http://localhost:8000 \
  --email driver@gmail.com \
  --password Test@1234 \
  --vehicle-id <UUID>
```

---

## API Documentation

Once running, access:
- **Swagger UI**: `http://localhost:8000/api/docs/`
- **ReDoc**: `http://localhost:8000/api/redoc/`
- **Schema**: `http://localhost:8000/api/schema/`

---

## RabbitMQ Topology

Six exchanges, all queues bound with dead-letter exchange `vayy.dlx` (routing key `dead.letter`):

| Exchange | Type | Queues | Routing keys |
|---|---|---|---|
| `location.topic` | topic | `auto.location`, `bike.location`, `passenger.location` | `location.auto`, `location.bike`, `location.passenger`, `location.*` |
| `dispatch.direct` | direct | `dispatch.assignment`, per-vehicle `dispatch.<vehicle_id>` | `dispatch.assign`, `dispatch.<vehicle_id>` |
| `notification.topic` | topic | `notification.events` | `notification.sms`, `notification.email`, `notification.push`, `notification.*` |
| `boarding.events` | topic | `boarding.requests` | `boarding.request.created/cancelled/boarded`, `boarding.*` |
| `trip.tracking` | topic | `trip.events` | `trip.started`, `trip.completed`, `trip.location`, `trip.*` |
| `matching.requests` | topic | `matching.ride_requests` | `matching.ride_request`, `matching.ride_lifecycle`, `matching.*` |

Infrastructure is created on startup by `RabbitMQService.setup_infrastructure()`.
