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

# RabbitMQ Exchanges
EXCHANGE_LOCATION = "location.topic"
EXCHANGE_DISPATCH = "dispatch.direct"
EXCHANGE_NOTIFICATION = "notification.topic"

# RabbitMQ Queues
QUEUE_LOCATION_AUTO = "auto.location"
QUEUE_LOCATION_BIKE = "bike.location"
QUEUE_LOCATION_PASSENGER = "passenger.location"
QUEUE_DISPATCH_ASSIGNMENT = "dispatch.assignment"
QUEUE_NOTIFICATION_EVENTS = "notification.events"

# Dead Letter Queues
QUEUE_DLX = "vayy.dlx"
QUEUE_DEAD_LETTER = "dead.letter"

# Routing Keys - Location
RK_LOCATION_AUTO = "location.auto"
RK_LOCATION_BIKE = "location.bike"
RK_LOCATION_PASSENGER = "location.passenger"
RK_LOCATION_ANY = "location.*"

# Routing Keys - Dispatch
RK_DISPATCH_ASSIGN = "dispatch.assign"
RK_DISPATCH_CANCEL = "dispatch.cancel"

# Routing Keys - Notification
RK_NOTIFICATION_SMS = "notification.sms"
RK_NOTIFICATION_EMAIL = "notification.email"
RK_NOTIFICATION_PUSH = "notification.push"
RK_NOTIFICATION_ANY = "notification.*"

# Boarding
EXCHANGE_BOARDING = "boarding.events"
QUEUE_BOARDING = "boarding.requests"
RK_BOARDING_CREATED = "boarding.request.created"
RK_BOARDING_CANCELLED = "boarding.request.cancelled"
RK_BOARDING_BOARDED = "boarding.request.boarded"
RK_BOARDING_ANY = "boarding.*"

# Trip Tracking
EXCHANGE_TRIP = "trip.tracking"
QUEUE_TRIP_EVENTS = "trip.events"
RK_TRIP_STARTED = "trip.started"
RK_TRIP_COMPLETED = "trip.completed"
RK_TRIP_LOCATION = "trip.location"
RK_TRIP_ANY = "trip.*"

# Matching / Ride Requests
EXCHANGE_MATCHING = "matching.requests"
QUEUE_MATCHING = "matching.ride_requests"
RK_MATCHING_RIDE_REQUEST = "matching.ride_request"
RK_MATCHING_RIDE_LIFECYCLE = "matching.ride_lifecycle"
RK_MATCHING_ANY = "matching.*"

# Existing (for backward compatibility if needed, but we will migrate)
RABBITMQ_DEFAULT_EXCHANGE = "vayy"
TRIP_QUEUE = QUEUE_TRIP_EVENTS
BOARDING_QUEUE = QUEUE_BOARDING
NOTIFICATION_QUEUE = QUEUE_NOTIFICATION_EVENTS