# VAYY Backend

Django REST backend for the VAYY route-based mobility platform. Handles auth, dispatch, tracking, transport, and real-time communication.

---

## Tech Stack

| Component | Technology |
|---|---|
| Framework | Django 6.0 + Django REST Framework |
| Language | Python 3.12 |
| Database | PostgreSQL 15 + PostGIS 3.3 |
| Cache / Channel Layers | Redis 7 |
| Message Broker | RabbitMQ |
| Task Queue | Celery + Celery Beat |
| ASGI Server | Daphne |
| Routing Engine | OSRM (Docker) |
| API Docs | drf-spectacular (Swagger / ReDoc) |
| Auth | SimpleJWT (access + refresh tokens) |
| Spatial Queries | Django GIS (PostGIS) |

---

## Project Structure

```
backend/vayy/
├── vayy/                    # Django project settings
│   ├── settings.py          # Main settings (env-based)
│   ├── urls.py              # Root URL configuration
│   ├── asgi.py              # ASGI + WebSocket routing
│   ├── wsgi.py              # WSGI entry point
│   └── celery.py            # Celery app configuration
│
├── accounts/                # User auth, profiles, wallet
│   ├── models.py            # User, PassengerProfile, DriverProfile, Wallet, Transaction, DriverDocument, RecentSearch
│   ├── managers.py          # Custom UserManager
│   ├── api/
│   │   ├── views.py         # Auth, profile, wallet, KYC views
│   │   ├── urls.py          # /api/accounts/* endpoints
│   │   └── serializers.py   # Request/response serializers
│   ├── services/
│   │   ├── auth_service.py
│   │   ├── otp_service.py
│   │   ├── verification_service.py
│   │   └── wallet_service.py
│   └── permissions.py       # IsDriver, IsPassenger
│
├── transport/               # Cities, routes, stops, schedules
│   ├── models.py            # City, Route, Stop, TripSchedule, StopTime
│   ├── api/
│   │   ├── views.py         # CRUD + nearby stops, ETA, geometry
│   │   ├── urls.py          # /api/transport/* endpoints
│   │   └── serializers.py
│   ├── selectors/
│   │   ├── city_selector.py
│   │   ├── route_selector.py
│   │   └── driver_route_selector.py
│   └── services/
│       └── osrm_service.py  # OSRM distance matrix, routing
│
├── operations/              # Vehicles, trips, dispatch, boarding
│   ├── models.py            # Vehicle, ActiveTrip, VehicleState, BoardingRequest, TripRating
│   ├── constants.py         # Trip status constants
│   ├── api/
│   │   ├── views.py         # Dispatch lifecycle, vehicles, trips, boarding, rating, history, earnings
│   │   ├── urls.py          # /api/operations/* endpoints
│   │   ├── ride_urls.py     # /api/ride/* endpoints (estimate, rating, history, earnings)
│   │   └── serializers.py
│   ├── services/
│   │   ├── dispatch_service.py   # Matching engine, dispatch state machine
│   │   ├── trip_service.py       # Trip start/management
│   │   ├── boarding_service.py   # Boarding request lifecycle
│   │   ├── vehicle_service.py    # Vehicle management
│   │   ├── ride_service.py       # Fare calculation, nearby vehicles
│   │   └── rating_service.py     # Trip rating
│   ├── selectors/
│   │   ├── trip_selector.py
│   │   ├── vehicle_selector.py
│   │   └── boarding_selector.py
│   ├── websockets/
│   │   ├── routing.py       # ws/dispatch/<uuid>/
│   │   └── consumers.py     # DispatchStatusConsumer
│   └── tasks.py             # Celery tasks (assignment timeout)
│
├── tracking/                # GPS ingestion, location tracking
│   ├── models.py            # HybridLog (GPS + cell towers + WiFi)
│   ├── api/
│   │   ├── views.py         # GPS ingest, nearby vehicles, passenger location
│   │   ├── urls.py          # /api/tracking/* endpoints
│   │   └── serializers.py
│   ├── services/
│   │   ├── gps_service.py       # GPS data ingestion
│   │   ├── location_service.py  # WS broadcast to passengers
│   │   ├── event_publisher.py   # Publish to RabbitMQ
│   │   ├── geo_service.py       # Spatial queries
│   │   └── eta_service.py       # ETA calculation
│   ├── selectors/
│   │   └── hybrid_selector.py
│   ├── consumers/
│   │   ├── gps_consumer.py
│   │   └── location_consumer.py
│   ├── websockets/
│   │   ├── routing.py       # ws/tracking/vehicle/<uuid>/, ws/tracking/trip/<uuid>/, ws/tracking/route-passengers/<uuid>/
│   │   └── consumers.py     # VehicleTrackingConsumer, TripTrackingConsumer, RoutePassengerTrackingConsumer
│   └── management/commands/
│       └── consume_location.py  # RabbitMQ → Celery consumer
│
├── communication/           # Notifications, email, SMS, push
│   ├── models.py            # Notification, NotificationPreference
│   ├── constants.py         # Notification types, RabbitMQ exchanges
│   ├── api/
│   │   ├── views.py         # Notification CRUD, preferences
│   │   ├── urls.py          # /api/communication/* endpoints
│   │   └── serializers.py
│   ├── services/
│   │   ├── notification_service.py  # Create & dispatch notifications
│   │   ├── push_service.py          # Push notifications
│   │   ├── email_service.py         # Email sending
│   │   ├── sms_service.py           # SMS sending
│   │   └── rabbitmq_service.py      # RabbitMQ publish/subscribe
│   ├── consumers/
│   │   └── notification_consumer.py
│   ├── websockets/
│   │   ├── routing.py       # ws/notifications/<user_id>/
│   │   └── consumers.py     # NotificationConsumer
│   └── tasks.py             # Celery tasks (notification dispatch)
│
├── common/                  # Shared utilities
│   ├── middleware.py         # CorrelationIDMiddleware
│   ├── constants.py         # ROLE_CHOICES, VEHICLE_TYPE_CHOICES, etc.
│   ├── responses.py         # success_response() / error_response()
│   └── websockets/
│       └── auth.py          # WebSocket JWT auth
│
├── tests/                   # Test suite
│   ├── test_dispatch.py
│   ├── test_ride_experience.py
│   └── test_driver_lifecycle.py
│
├── scripts/                 # Simulation scripts
│   ├── simulate_passenger.py
│   ├── simulate_driver.py
│   ├── test_single_passenger.py
│   ├── test_passengers.py
│   └── test_passengers_lucknow_raebareli.py
│
├── manage.py
├── requirements.txt
├── Dockerfile
├── entrypoint.sh
└── .env
```

---

## API Endpoints

### Accounts (`/api/accounts/`)

| Method | Endpoint | Auth | Description |
|---|---|---|---|
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
| POST | `driver/documents/` | Yes | Upload KYC (LICENSE, RC, INSURANCE) |
| GET/POST | `recent-searches/` | Yes | Recent search history |

### Transport (`/api/transport/`)

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| GET/POST | `cities/` | Yes | City CRUD |
| GET/POST | `routes/` | Yes | Route CRUD |
| GET/POST | `stops/` | Yes | Stop CRUD |
| GET/POST | `schedules/` | Yes | Trip schedule CRUD |
| GET | `driver/routes/` | Yes | Routes assigned to driver |
| GET | `routes/<id>/geometry/` | Yes | Route geometry (GeoJSON LineString) |
| GET | `routes/<id>/schedule/` | Yes | Route schedule with stop times |
| GET | `routes/<id>/nearby-passengers/` | Yes | Passengers along route |
| GET | `stops/nearby/` | Yes | Nearby stops (PostGIS) |
| GET | `stops/<id>/eta/` | Yes | ETA to stop |
| GET | `routes/search-by-location/` | Yes | Search routes by lat/lng |
| GET | `routes/preview/` | Yes | Route preview |
| GET | `routes/bus/<bus_number>/` | Yes | Route by bus number |

### Operations (`/api/operations/`)

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| GET | `vehicles/` | Yes | List vehicles (by city/route) |
| GET | `vehicles/me/` | Driver | Driver's assigned vehicle |
| GET | `vehicles/<id>/` | Yes | Vehicle detail |
| GET | `vehicles/<id>/state/` | Yes | Vehicle runtime state |
| GET | `trips/` | Yes | List active trips |
| GET | `trips/me/active/` | Driver | Driver's active trip |
| POST | `trips/start/` | Driver | Start a trip |
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

### Ride (`/api/ride/`)

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| POST | `estimate/` | Passenger | Get fare estimate |
| POST | `rating/` | Passenger | Rate completed trip |
| GET | `history/` | Yes | Trip history (paginated) |
| GET | `earnings/` | Driver | Driver earnings (today/week/month/all) |

### Tracking (`/api/tracking/`)

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| POST | `gps/` | Driver | GPS data ingestion |
| POST | `ingest/` | Driver | Alias for GPS ingest |
| GET | `nearby/` | Yes | Nearby vehicles (PostGIS) |
| GET | `vehicle/<id>/` | Yes | Vehicle location history |
| GET | `trip/<id>/` | Yes | Trip location history |
| POST | `passenger-location/` | Passenger | Update passenger location |

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

| Endpoint | Auth | Consumer | Purpose |
|---|---|---|---|
| `ws/tracking/vehicle/<uuid>/` | JWT | `VehicleTrackingConsumer` | Driver sends GPS → RabbitMQ → broadcast to passengers |
| `ws/tracking/trip/<uuid>/` | JWT | `TripTrackingConsumer` | Passenger receives live vehicle position |
| `ws/tracking/route-passengers/<uuid>/` | JWT | `RoutePassengerTrackingConsumer` | Driver sees passengers along route |
| `ws/dispatch/<uuid>/` | No | `DispatchStatusConsumer` | Dispatch status updates (accept/reject/arrived/complete) |
| `ws/notifications/<str:user_id>/` | No | `NotificationConsumer` | Push notifications to user |

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

On `COMPLETED`: fare calculated, wallet transfer executed, driver stats updated.

---

## Real-Time Data Pipeline

```
Driver App (WS) → VehicleTrackingConsumer.receive()
  → TrackingEventPublisher.publish_location() → RabbitMQ (location.*)
  → consume_location command (long-running consumer)
  → Celery task: LocationService.process_location_update()
  → Channel layer broadcast → Passenger WS groups
  → Passenger App receives vehicle_update
```

---

## Matching Engine

`DispatchService.find_best_candidates()` ranks drivers by:

1. **Distance** (max 50 pts) — road distance via OSRM matrix
2. **Rating** (max 30 pts) — driver profile rating × 6
3. **Occupancy** (max 10 pts) — lower occupancy = higher score
4. **Route compatibility** (max 10 pts) — city match

Only **verified drivers** (`driver_profile.is_verified=True`) with **no active trip** within **10km** are considered.

---

## Payment Flow

On trip completion (`COMPLETED` status):

1. `RideService.calculate_final_fare()` computes fare based on route distance
2. `WalletService.transfer_funds()` debits passenger wallet, credits driver wallet
3. `NotificationService.create()` sends "Ride Completed" notification to passenger

---

## Infrastructure (Docker)

| Service | Image | Port | Purpose |
|---|---|---|---|
| `db` | `postgis/postgis:15-3.3` | 5435 | PostgreSQL + PostGIS |
| `redis` | `redis:7-alpine` | 6379 | Cache + Channel Layers |
| `backend` | Custom Django | 8000 | REST API + Daphne ASGI |
| `osrm` | `osrm/osrm-backend` | 5000 | Routing engine |
| `celery_worker` | Custom Django | — | Async task processing |
| `celery_beat` | Custom Django | — | Periodic task scheduler |
| `frontend` | Custom Vite | 3000 | Admin panel |
| `nginx` | `nginx:alpine` | 80 | Reverse proxy |

```bash
# Start all services
docker-compose up -d

# View logs
docker-compose logs -f backend

# Run migrations
docker-compose exec backend python manage.py migrate

# Create superuser
docker-compose exec backend python manage.py createsuperuser

# Run simulation scripts
docker-compose exec backend python scripts/simulate_driver.py
docker-compose exec backend python scripts/simulate_passenger.py
```

---

## Environment Variables

Required in `.env`:

```env
SECRET_KEY=your-secret-key
DEBUG=true
DATABASE_URL=postgis://postgres:password@db:5432/vayy_db
REDIS_URL=redis://redis:6379/0
CELERY_BROKER_URL=amqp://admin:admin123@rabbitmq:5672/
RABBITMQ_URL=amqp://admin:admin123@rabbitmq:5672/
OSRM_URL=http://osrm:5000
EMAIL_HOST=smtp.example.com
EMAIL_PORT=587
EMAIL_HOST_USER=your-email
EMAIL_HOST_PASSWORD=your-password
```

---

## Development

```bash
# Install dependencies
pip install -r requirements.txt

# Run migrations
python manage.py migrate

# Run server
python manage.py runserver

# Run Celery worker
celery -A vayy worker -l info

# Run Celery beat
celery -A vayy beat -l info

# Run RabbitMQ location consumer
python manage.py consume_location

# Run tests
python manage.py test

# Generate API schema
python manage.py spectacular --color --file schema.yml
```

---

## API Documentation

Once running, access:
- **Swagger UI**: `http://localhost:8000/api/docs/`
- **ReDoc**: `http://localhost:8000/api/redoc/`
- **Schema**: `http://localhost:8000/api/schema/`
