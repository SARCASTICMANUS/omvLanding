# VAYY Backend Guidelines

## Project Overview

VAYY is a route-based public transit and real-time mobility platform. The backend provides APIs for passenger route discovery, driver dispatch, real-time GPS tracking, and wallet-based payments. It supports three user roles: Passenger, Driver (bike/auto), and Admin/City Admin.

## Tech Stack

* Python 3.12
* Django 6.0.6 + Django REST Framework 3.17.1
* PostgreSQL 15 + PostGIS 3.3
* Redis 7 (cache, channel layer, GEO queries, route state)
* RabbitMQ 3.13 (message broker)
* Celery + Celery Beat 5.6.3 (task queue)
* Daphne (ASGI server)
* Django Channels 4.2.0 (WebSockets)
* OSRM (routing engine)
* SimpleJWT (authentication)
* drf-spectacular (API documentation)

## Project Structure

```
vayy/
├── vayy/                    # Django project settings
│   ├── settings.py          # All configuration
│   ├── urls.py              # Root URL routing
│   ├── asgi.py              # ASGI with WebSocket support
│   ├── celery.py            # Celery app configuration
│   └── wsgi.py              # WSGI entry point
├── accounts/                # User auth, profiles, wallet, KYC
├── transport/               # Cities, routes, stops, schedules
├── operations/              # Vehicles, trips, dispatch, boarding
├── tracking/                # GPS ingestion, location tracking, ETA, matching
├── communication/           # Notifications, email, SMS, push
├── common/                  # Shared utilities
├── tests/                   # Test suite (pytest)
├── scripts/                 # Simulation scripts
├── osrm/                    # Pre-processed OSRM map data
├── nginx/                   # Nginx reverse proxy config
├── staticfiles/             # Collected static files
├── manage.py                # Django management entry point
├── requirements.txt         # 57 pinned dependencies
├── Dockerfile               # Python 3.12-slim + GDAL/GEOS/PROJ
├── docker-compose.yaml      # 7 services: web, celery, redis, rabbitmq, nginx, osrm, redisinsight
└── entrypoint.sh            # Wait for PG → migrate → collectstatic → createsuperuser → Daphne
```

## Architecture Patterns

### Layered Architecture (Controller-Service-Repository)
Each app follows a consistent 4-layer pattern:
- **API Layer** (`api/views.py`, `api/serializers.py`, `api/urls.py`): DRF views and serializers
- **Service Layer** (`services/`): Business logic, state machines, external integrations
- **Selector Layer** (`selectors/`): Query/read-only data access patterns
- **Model Layer** (`models.py`): Django ORM models with PostGIS spatial fields

### Event-Driven Architecture (RabbitMQ)
6 exchanges for decoupled communication:
- **`location.topic`** (Topic): GPS/location events
- **`dispatch.direct`** (Direct): Driver assignment/cancellation events
- **`notification.topic`** (Topic): Push/email/SMS notification events
- **`boarding.events`** (Topic): Passenger boarding request lifecycle events
- **`trip.tracking`** (Topic): Trip start/completion/location events
- **`matching.requests`** (Topic): Ride request matching events

All queues use dead-letter exchanges (`vayy.dlx`) for failed message handling.

### Real-Time Pipeline
```
Driver GPS (WS or HTTP)
  → VehicleTrackingConsumer / GPSService
    → Celery task (process_location_update)
      → LocationService.process_location_update()
        → DB update (VehicleState, HybridLog)
        → OSRM snap-to-route + ETA computation
        → Redis GEO set (nearby vehicle queries)
        → Redis route state (route-based vehicle tracking)
        → WebSocket broadcast (vehicle_*, trip_*, route_* groups)
```

### Dispatch State Machine
```
ASSIGNED → ACCEPTED/REJECTED/CANCELLED
ACCEPTED → ARRIVED/CANCELLED
ARRIVED → ACTIVE/CANCELLED
ACTIVE → COMPLETED/CANCELLED
```
On COMPLETED: fare calculation → wallet transfer → driver stats update → notification.

## Main Components

### accounts/ — User Management
- **User model**: Custom AbstractUser with email as USERNAME_FIELD, role-based (passenger/bikedriver/autodriver/admin)
- **PublicPassengerProfile**: Display name, phone, home/current location (PostGIS Point), saved routes
- **PublicDriverProfile**: License number, vehicle type, rating, total trips, is_verified flag
- **Wallet**: Decimal balance, INR currency, linked to user
- **Transaction**: Credit/debit with status tracking and metadata JSON
- **DriverDocument**: KYC document upload (LICENSE, RC, INSURANCE) with verification status
- **RecentSearch**: Pickup/destination coordinates saved for quick re-access
- **Services**: OTP-based auth (register, login, forgot password), wallet fund transfers, KYC verification

### transport/ — Route Infrastructure
- **City**: Named city with PostGIS location point
- **Route**: LineString geometry, bus number, total distance, start/end names
- **Stop**: Ordered stop on a route with PostGIS location, geometry (road segment to next stop), cumulative distance/duration
- **TripSchedule**: Scheduled start time for a route
- **StopTime**: Arrival time at each stop for a schedule
- **Services**: OSRM service wrapper (route, table, nearest, match, trip, tile endpoints), geocoding, route geometry

### operations/ — Vehicle & Trip Operations
- **Vehicle**: Physical vehicle with type, assigned driver, city, route
- **ActiveTrip**: Live running trip with status state machine, direction (outbound/inbound), current stop/segment
- **VehicleState**: Runtime state with current/snapped location, speed, heading, occupancy, delay, distance along route
- **BoardingRequest**: Passenger intent to board at a specific stop (pending/approaching/boarded/completed/cancelled)
- **TripRating**: Passenger rating + review for completed trip
- **Services**: DispatchService (matching engine, state machine, settlement), TripService, BoardingService, VehicleService, RideService (fare estimates), RatingService

### tracking/ — GPS & Location Intelligence
- **HybridLog**: Multi-source location ingestion (GPS + cell towers + WiFi)
- **LocationService**: Core GPS processing pipeline (snap-to-route, stop detection, direction, ETA, Redis sync, WS broadcast)
- **MatchingService**: Multi-stage ride matching (route → direction → sequence → proximity → ETA ranking)
- **RedisGeoService**: Redis GEOADD/GEORADIUS for sub-millisecond nearby vehicle lookups
- **RedisRouteService**: Redis-backed route state cache (vehicle positions on routes, ETAs, ride requests)
- **ETAService**: Provider-based ETA calculation (OSRM with fallback to haversine)
- **GPSService**: Raw GPS ingestion into HybridLog + trigger Celery processing
- **EventPublisher**: Publishes tracking events to RabbitMQ exchanges

### communication/ — Notifications & Messaging
- **Notification**: In-app notification records with type, status, metadata
- **NotificationPreference**: User preferences (email, SMS, push, trip updates, boarding updates, etc.)
- **NotificationService**: Creates notifications, broadcasts via WebSocket, publishes to RabbitMQ
- **RabbitMQService**: Singleton pika connection with publisher confirms, persistent messages, infrastructure setup
- **EmailService, SMSService, PushService**: External delivery services
- **NotificationConsumer**: Routes notifications to appropriate delivery service

### common/ — Shared Utilities
- **Constants**: Role choices, vehicle types, transaction statuses, document types
- **CorrelationIDMiddleware**: Generates/tracks X-Correlation-ID across requests
- **Standardized responses**: `success_response()` / `error_response()` wrappers
- **BaseAuthenticatedConsumer**: JWT-authenticated WebSocket base class

## API Endpoints

### Authentication (`/api/accounts/`)
- POST `/api/accounts/register/` — Register new user (sends OTP)
- POST `/api/accounts/login/` — Login (returns JWT tokens)
- POST `/api/accounts/verify-otp/` — Verify OTP
- POST `/api/accounts/resend-otp/` — Resend OTP
- POST `/api/accounts/forgot-password/` — Request password reset OTP
- POST `/api/accounts/reset-password/` — Reset password with OTP
- POST `/api/accounts/token/refresh/` — Refresh JWT token
- GET/POST `/api/accounts/recent-searches/` — Get/save recent searches

### Transport (`/api/transport/`)
- GET `/api/transport/cities/` — List cities
- GET `/api/transport/routes/` — List routes
- GET `/api/transport/stops/` — List stops
- GET `/api/transport/schedules/` — List trip schedules

### Operations (`/api/operations/`)
- GET `/api/operations/vehicles/` — List vehicles
- POST `/api/operations/dispatch/request/` — Request dispatch
- POST `/api/operations/dispatch/{id}/accept/` — Accept dispatch
- POST `/api/operations/dispatch/{id}/reject/` — Reject dispatch
- POST `/api/operations/dispatch/{id}/arrived/` — Mark arrived
- POST `/api/operations/dispatch/{id}/start/` — Start trip
- PATCH `/api/operations/dispatch/{id}/complete/` — Complete trip
- POST `/api/operations/dispatch/{id}/cancel/` — Cancel dispatch

### Tracking (`/api/tracking/`)
- POST `/api/tracking/location/` — Submit GPS location
- GET `/api/tracking/vehicles/nearby/` — Get nearby vehicles
- GET `/api/tracking/routes/{id}/vehicles/` — Get vehicles on route

### Communication (`/api/communication/`)
- GET `/api/communication/notifications/` — List notifications
- PUT `/api/communication/notifications/{id}/read/` — Mark as read

### API Documentation
- Swagger UI: `/api/docs/`
- ReDoc: `/api/redoc/`
- Schema: `/api/schema/`

## WebSocket Endpoints

- `ws/dispatch/<uuid:dispatch_id>/` — Dispatch status updates (no auth)
- `ws/tracking/vehicle/<uuid:vehicle_id>/` — Vehicle location updates (JWT auth)
- `ws/tracking/trip/<uuid:trip_id>/` — Trip tracking updates (JWT auth)
- `ws/notifications/<uuid:user_id>/` — Notification delivery (no auth)

## Development Rules

* Follow the Controller-Service-Repository pattern for all new endpoints
* Use `success_response()` / `error_response()` for API responses
* All responses wrapped in `{ success, message, data }` format
* Use Celery tasks for async operations (GPS processing, notifications, dispatch timeouts)
* Use RabbitMQ for event-driven communication between services
* Use Redis GEO for spatial queries (nearby vehicles)
- Use PostGIS for spatial database queries
- Use OSRM for routing and ETA calculations
- Use JWT for authentication (access: 2 days, refresh: 7 days)

## Protected Rules

Do NOT:
* Change API contract format (`{ success, message, data }`)
* Remove existing API endpoints
* Change database models without migrations
* Remove RabbitMQ exchanges or queues
* Change WebSocket message formats
* Remove Celery task definitions
* Modify authentication flow without coordination

## How to Run

### Docker (Recommended)
```bash
cd backend/vayy
docker-compose up -d --build
```
Starts: web (Daphne on :8000), celery worker + boarding consumer, redis (:6379), rabbitmq (:5672, :15672), nginx (:80), osrm (:5000), redisinsight (:5540).

### Local Development
```bash
cd backend/vayy
python -m venv venv && source venv/bin/activate
pip install -r requirements.txt
python manage.py migrate
python manage.py runserver                              # API
daphne -p 8000 vayy.asgi:application                    # ASGI (WebSockets + HTTP)
celery -A vayy worker -l info -Q celery,tracking,dispatch  # Celery workers
celery -A vayy beat -l info                              # Periodic tasks
python manage.py consume_boarding                       # RabbitMQ boarding consumer
```

### Running Tests
```bash
python manage.py test
# or with pytest:
pytest backend/vayy/tests/
```

### Simulation Scripts
```bash
# GPS simulator (route-based, follows real route geometry)
python3 scripts/route_gps_simulator.py \
  --api-url http://localhost:8000 \
  --email driver@gmail.com \
  --password zxcv9876 \
  --vehicle-id <UUID> \
  --route-id <UUID> \
  --duration 600

# Simple GPS simulator (HTTP -> RabbitMQ pipeline)
python3 scripts/driver_gps_rabbitmq_simulator.py \
  --api-url http://localhost:8000 \
  --email driver@gmail.com \
  --password Test@1234 \
  --vehicle-id <UUID>
```

## Critical Context

- Backend wraps all responses in `{ success, message, data }` format
- Backend roles: `passenger`, `bikedriver`, `autodriver`, `admin` (not `driver`)
- Auth flow: Register → OTP sent → Verify OTP → Login (tokens only at login, not register)
- `CompleteTripAPIView` is commented out in urls.py; `DispatchCompleteAPIView` (PATCH) is the active endpoint for completing trips
- The `consume_boarding` management command is a long-running RabbitMQ consumer that bridges boarding events to Celery tasks
- OSRM is pre-processed in the `osrm/` directory with MLD algorithm for fast routing
- Redis serves three roles: channel layer (Django Channels), GEO-based spatial queries, and route state caching with TTLs

## Relevant Files

- `backend/vayy/vayy/settings.py`: All Django settings
- `backend/vayy/vayy/urls.py`: Root URL routing
- `backend/vayy/vayy/asgi.py`: ASGI with WebSocket support
- `backend/vayy/vayy/celery.py`: Celery app configuration
- `backend/vayy/accounts/models.py`: User, Profile, Wallet, Transaction models
- `backend/vayy/accounts/api/views.py`: Authentication views
- `backend/vayy/accounts/api/urls.py`: Auth endpoint URLs
- `backend/vayy/accounts/api/serializers.py`: Auth serializers
- `backend/vayy/accounts/services/auth_service.py`: OTP-based authentication
- `backend/vayy/transport/models.py`: City, Route, Stop, Schedule models
- `backend/vayy/transport/api/views.py`: Transport views
- `backend/vayy/transport/services/osrm_service.py`: OSRM routing wrapper
- `backend/vayy/operations/models.py`: Vehicle, ActiveTrip, VehicleState, BoardingRequest models
- `backend/vayy/operations/api/views.py`: Dispatch and trip views
- `backend/vayy/operations/services/dispatch_service.py`: Dispatch matching engine
- `backend/vayy/operations/services/trip_service.py`: Trip lifecycle management
- `backend/vayy/operations/tasks.py`: Celery tasks for dispatch timeouts
- `backend/vayy/operations/websockets/consumers.py`: Dispatch WebSocket consumer
- `backend/vayy/tracking/models.py`: HybridLog location model
- `backend/vayy/tracking/api/views.py`: Tracking views
- `backend/vayy/tracking/services/location_service.py`: GPS processing pipeline
- `backend/vayy/tracking/services/matching_service.py`: Multi-stage ride matching
- `backend/vayy/tracking/services/redis_geo_service.py`: Redis GEO spatial queries
- `backend/vayy/tracking/services/event_publisher.py`: RabbitMQ event publishing
- `backend/vayy/tracking/tasks.py`: Celery tasks for GPS processing
- `backend/vayy/tracking/websockets/consumers.py`: Vehicle and trip tracking consumers
- `backend/vayy/tracking/management/commands/consume_location.py`: RabbitMQ location consumer
- `backend/vayy/communication/models.py`: Notification models
- `backend/vayy/communication/services/notification_service.py`: Notification delivery
- `backend/vayy/communication/services/rabbitmq_service.py`: RabbitMQ connection manager
- `backend/vayy/communication/tasks.py`: Celery tasks for notifications
- `backend/vayy/communication/consumers/notification_consumer.py`: Notification routing
- `backend/vayy/common/constants.py`: Shared constants
- `backend/vayy/common/responses.py`: Standardized response helpers
- `backend/vayy/common/middleware.py`: Correlation ID middleware
- `backend/vayy/common/websockets/auth.py`: JWT WebSocket authentication
- `backend/vayy/docker-compose.yaml`: Docker service definitions
- `backend/vayy/requirements.txt`: Python dependencies
- `backend/vayy/README.md`: Comprehensive backend documentation
