# =============================================================================
# Common Constants — Single source of truth for the entire application
# =============================================================================

# --- Roles ---

ROLE_PASSENGER = "passenger"
ROLE_BIKE_DRIVER = "bikedriver"
ROLE_AUTO_DRIVER = "autodriver"
ROLE_ADMIN = "admin"

ROLE_CHOICES = (
    (ROLE_PASSENGER, "Passenger"),
    (ROLE_BIKE_DRIVER, "Bike Driver"),
    (ROLE_AUTO_DRIVER, "Auto Driver"),
    (ROLE_ADMIN, "Admin"),
)

# --- Vehicle Types ---

VEHICLE_BIKE = "bike"
VEHICLE_AUTO = "auto"

VEHICLE_TYPE_AUTO = VEHICLE_AUTO
VEHICLE_TYPE_BIKE = VEHICLE_BIKE

VEHICLE_TYPE_CHOICES = (
    (VEHICLE_BIKE, "Bike"),
    (VEHICLE_AUTO, "Auto-Rickshaw"),
)

# --- Wallet & Transactions ---

TX_TYPE_CREDIT = "credit"
TX_TYPE_DEBIT = "debit"

TX_TYPE_CHOICES = (
    (TX_TYPE_CREDIT, "Credit"),
    (TX_TYPE_DEBIT, "Debit"),
)

TX_STATUS_PENDING = "pending"
TX_STATUS_COMPLETED = "completed"
TX_STATUS_FAILED = "failed"

TX_STATUS_CHOICES = (
    (TX_STATUS_PENDING, "Pending"),
    (TX_STATUS_COMPLETED, "Completed"),
    (TX_STATUS_FAILED, "Failed"),
)

# --- Driver KYC & Documents ---

DOC_TYPE_LICENSE = "LICENSE"
DOC_TYPE_RC = "RC"
DOC_TYPE_INSURANCE = "INSURANCE"
DOC_TYPE_IDENTITY = "IDENTITY"

DOC_TYPE_CHOICES = (
    (DOC_TYPE_LICENSE, "Driving License"),
    (DOC_TYPE_RC, "Registration Certificate"),
    (DOC_TYPE_INSURANCE, "Vehicle Insurance"),
    (DOC_TYPE_IDENTITY, "Identity Proof"),
)

DOC_STATUS_PENDING = "PENDING"
DOC_STATUS_VERIFIED = "VERIFIED"
DOC_STATUS_REJECTED = "REJECTED"

DOC_STATUS_CHOICES = (
    (DOC_STATUS_PENDING, "Pending"),
    (DOC_STATUS_VERIFIED, "Verified"),
    (DOC_STATUS_REJECTED, "Rejected"),
)

# --- Vehicle Registration Status ---

VEHICLE_STATUS_PENDING = "pending_approval"
VEHICLE_STATUS_APPROVED = "approved"
VEHICLE_STATUS_REJECTED = "rejected"

VEHICLE_STATUS_CHOICES = (
    (VEHICLE_STATUS_PENDING, "Pending Approval"),
    (VEHICLE_STATUS_APPROVED, "Approved"),
    (VEHICLE_STATUS_REJECTED, "Rejected"),
)

# --- Trip Status ---

TRIP_STATUS_REQUESTED = "requested"
TRIP_STATUS_ASSIGNED = "assigned"
TRIP_STATUS_ACCEPTED = "accepted"
TRIP_STATUS_REJECTED = "rejected"
TRIP_STATUS_ARRIVED = "arrived"
TRIP_STATUS_ACTIVE = "active"
TRIP_STATUS_COMPLETED = "completed"
# Settlement ran but at least one passenger debit is still outstanding. The
# trip is over (vehicle is released, ended_at is set); only the money is
# unfinished. It transitions to COMPLETED once the last debit succeeds.
TRIP_STATUS_PARTIALLY_SETTLED = "partially_settled"
TRIP_STATUS_CANCELLED = "cancelled"

TRIP_STATUS_CHOICES = (
    (TRIP_STATUS_REQUESTED, "Requested"),
    (TRIP_STATUS_ASSIGNED, "Assigned"),
    (TRIP_STATUS_ACCEPTED, "Accepted"),
    (TRIP_STATUS_REJECTED, "Rejected"),
    (TRIP_STATUS_ARRIVED, "Arrived"),
    (TRIP_STATUS_ACTIVE, "Active"),
    (TRIP_STATUS_COMPLETED, "Completed"),
    (TRIP_STATUS_PARTIALLY_SETTLED, "Partially Settled"),
    (TRIP_STATUS_CANCELLED, "Cancelled"),
)

# --- Boarding Request Status ---

BOARDING_PENDING = "pending"
BOARDING_APPROACHING = "approaching"
BOARDING_BOARDED = "boarded"
BOARDING_COMPLETED = "completed"
BOARDING_CANCELLED = "cancelled"

BOARDING_STATUS_CHOICES = (
    (BOARDING_PENDING, "Pending"),
    (BOARDING_APPROACHING, "Approaching"),
    (BOARDING_BOARDED, "Boarded"),
    (BOARDING_COMPLETED, "Completed"),
    (BOARDING_CANCELLED, "Cancelled"),
)

# --- Dispatch Mode ---

DISPATCH_MODE_DIRECT = "direct"
DISPATCH_MODE_BROADCAST = "broadcast"

DISPATCH_MODE_CHOICES = (
    (DISPATCH_MODE_DIRECT, "Direct Assignment"),
    (DISPATCH_MODE_BROADCAST, "Broadcast Assignment"),
)

# --- Journeys (route-free driver trips) ---
#
# A driver declares origin -> destination; the server builds one direct OSRM
# path, attaches the admin-managed global stops that fall inside the corridor
# around it, and holds both in Redis for the life of the trip. The Route table
# is untouched and unused by this flow.

# How far a global stop may sit from the journey path and still be considered
# "on the way".
JOURNEY_CORRIDOR_RADIUS_M = 5000

# How close a passenger must be to a global stop to raise a hand there.
PASSENGER_STOP_RADIUS_M = 500
PASSENGER_HAND_RAISE_RADIUS_M = 3000

# Safety net for the Redis journey documents. Journey end deletes them
# explicitly; this only catches keys orphaned by a crash mid-trip.
JOURNEY_PATH_TTL_SECONDS = 43200  # 12 hours

# Reported path precision. Keeps the Redis document small; OSRM geometry is
# far denser than any GPS fix this platform consumes.
JOURNEY_PATH_POINT_LIMIT = 4000

# --- Notification Types & Status ---

NOTIFICATION_EMAIL = "email"
NOTIFICATION_SMS = "sms"
NOTIFICATION_PUSH = "push"
NOTIFICATION_IN_APP = "in_app"

NOTIFICATION_TYPE_CHOICES = (
    (NOTIFICATION_EMAIL, "Email"),
    (NOTIFICATION_SMS, "SMS"),
    (NOTIFICATION_PUSH, "Push"),
    (NOTIFICATION_IN_APP, "In App"),
)

NOTIFICATION_PENDING = "pending"
NOTIFICATION_SENT = "sent"
NOTIFICATION_FAILED = "failed"

NOTIFICATION_STATUS_CHOICES = (
    (NOTIFICATION_PENDING, "Pending"),
    (NOTIFICATION_SENT, "Sent"),
    (NOTIFICATION_FAILED, "Failed"),
)

# --- Route Visibility ---

ROUTE_PUBLIC = "public"
ROUTE_PRIVATE = "private"

ROUTE_VISIBILITY_CHOICES = (
    (ROUTE_PUBLIC, "Public"),
    (ROUTE_PRIVATE, "Private"),
)

# =============================================================================
# RabbitMQ — Exchanges, Queues, Routing Keys
# =============================================================================

# --- Exchanges ---

EXCHANGE_LOCATION = "location.topic"
EXCHANGE_DISPATCH = "dispatch.direct"
EXCHANGE_NOTIFICATION = "notification.topic"
EXCHANGE_BOARDING = "boarding.events"
EXCHANGE_TRIP = "trip.tracking"
EXCHANGE_MATCHING = "matching.requests"

# --- Queues ---

QUEUE_LOCATION_AUTO = "auto.location"
QUEUE_LOCATION_BIKE = "bike.location"
QUEUE_LOCATION_PASSENGER = "passenger.location"
QUEUE_DISPATCH_ASSIGNMENT = "dispatch.assignment"
# Recipients for the two fixed dispatch keys above. These are event-stream
# queues, not delivery paths: driver-facing delivery happens over WebSocket.
QUEUE_DISPATCH_EVENTS = "dispatch.events"
QUEUE_DISPATCH_PUSH = "dispatch.pushes"
QUEUE_NOTIFICATION_EVENTS = "notification.events"
QUEUE_BOARDING = "boarding.requests"
QUEUE_TRIP_EVENTS = "trip.events"
QUEUE_MATCHING = "matching.ride_requests"

# --- Dead Letter Queues ---

QUEUE_DLX = "vayy.dlx"
QUEUE_DEAD_LETTER = "dead.letter"

# --- Routing Keys: Location ---

RK_LOCATION_AUTO = "location.auto"
RK_LOCATION_BIKE = "location.bike"
RK_LOCATION_PASSENGER = "location.passenger"
RK_LOCATION_ANY = "location.*"

# --- Routing Keys: Dispatch ---

RK_DISPATCH_ASSIGN = "dispatch.assign"
RK_DISPATCH_CANCEL = "dispatch.cancel"
# dispatch.direct is a DIRECT exchange, so wildcards do not apply and a key
# built from a trip status or a vehicle id ("dispatch.arrived",
# "dispatch.<uuid>") can never match a binding. Those two publishers now use
# these fixed keys and carry the status / vehicle_id in the payload instead.
RK_DISPATCH_EVENT = "dispatch.event"
RK_DISPATCH_PUSH = "dispatch.push"

# --- Routing Keys: Notification ---

RK_NOTIFICATION_SMS = "notification.sms"
RK_NOTIFICATION_EMAIL = "notification.email"
RK_NOTIFICATION_PUSH = "notification.push"
RK_NOTIFICATION_ANY = "notification.*"

# --- Routing Keys: Boarding ---

RK_BOARDING_CREATED = "boarding.request.created"
RK_BOARDING_CANCELLED = "boarding.request.cancelled"
RK_BOARDING_BOARDED = "boarding.request.boarded"
# Must be "boarding.#", not "boarding.*": in a topic exchange "*" matches
# exactly ONE word, so "boarding.*" does not match the three-word keys above
# and every boarding event was silently discarded. "#" matches zero or more
# words, so it holds for the current keys and any future boarding.* shape.
RK_BOARDING_ANY = "boarding.#"

# --- Routing Keys: Trip ---

RK_TRIP_STARTED = "trip.started"
RK_TRIP_COMPLETED = "trip.completed"
RK_TRIP_LOCATION = "trip.location"
RK_TRIP_ANY = "trip.*"

# --- Routing Keys: Matching ---

RK_MATCHING_RIDE_REQUEST = "matching.ride_request"
RK_MATCHING_RIDE_LIFECYCLE = "matching.ride_lifecycle"
RK_MATCHING_ANY = "matching.*"

# --- Exchanges: Geo ---
EXCHANGE_GEO = "geo"

# --- Queues: Geo ---
QUEUE_GEO_EVENTS = "geo_events"

# --- Routing Keys: Geo ---
RK_GEO_EVENT = "geo.event"

# --- Matching (app-level keys) ---

RIDE_REQUEST_KEY = "matching.ride_request"
RIDE_LIFECYCLE_KEY = "matching.ride_lifecycle"

# --- Registration Job ---

REGISTRATION_PAYLOAD_PREFIX = "vayy:registration:payload"
REGISTRATION_PAYLOAD_TTL = 300  # 5 minutes

# =============================================================================
# Backward Compatibility Aliases
# =============================================================================

RABBITMQ_DEFAULT_EXCHANGE = "vayy"
TRIP_QUEUE = QUEUE_TRIP_EVENTS
BOARDING_QUEUE = QUEUE_BOARDING
NOTIFICATION_QUEUE = QUEUE_NOTIFICATION_EVENTS
TRACKING_EXCHANGE = EXCHANGE_LOCATION
TRIP_STARTED = RK_TRIP_STARTED
TRIP_COMPLETED = RK_TRIP_COMPLETED
TRIP_LOCATION = RK_TRIP_LOCATION
BOARDING_EXCHANGE = EXCHANGE_BOARDING
BOARDING_CREATED_KEY = RK_BOARDING_CREATED
BOARDING_CANCELLED_KEY = RK_BOARDING_CANCELLED
BOARDING_BOARDED_KEY = RK_BOARDING_BOARDED

# =============================================================================
# WebSocket Channel Groups
# =============================================================================

# Fan-out group for the operations console. Every GPS fix is mirrored here in
# addition to the per-vehicle and per-trip groups so an admin can hold a single
# socket open and watch the whole fleet, instead of needing one socket per
# vehicle (browsers cap concurrent sockets per origin, and the per-id groups are
# correctly owner-scoped so an admin cannot join them).
#
# Membership is gated by AdminMonitorConsumer (staff/admin only) because this
# group carries every vehicle's live position.
WS_GROUP_ADMIN_FLEET = "admin_fleet"
