# Vehicle Types

VEHICLE_TYPE_BUS = "bus"
VEHICLE_TYPE_VAN = "van"
VEHICLE_TYPE_MINIBUS = "minibus"
VEHICLE_TYPE_CAR = "car"
VEHICLE_TYPE_AUTO = "auto"
VEHICLE_TYPE_TEMPO = "tempo"

VEHICLE_TYPE_CHOICES = (
    (VEHICLE_TYPE_BUS, "Bus"),
    (VEHICLE_TYPE_VAN, "Van"),
    (VEHICLE_TYPE_MINIBUS, "Minibus"),
    (VEHICLE_TYPE_CAR, "Car"),
    (VEHICLE_TYPE_AUTO, "Auto-Rickshaw"),
    (VEHICLE_TYPE_TEMPO, "Tempo Traveller"),
)


# Active Trip Status

TRIP_STATUS_REQUESTED = "requested"
TRIP_STATUS_ASSIGNED = "assigned"
TRIP_STATUS_ACCEPTED = "accepted"
TRIP_STATUS_REJECTED = "rejected"
TRIP_STATUS_ARRIVED = "arrived"
TRIP_STATUS_ACTIVE = "active"
TRIP_STATUS_COMPLETED = "completed"
TRIP_STATUS_CANCELLED = "cancelled"

TRIP_STATUS_CHOICES = (
    (TRIP_STATUS_REQUESTED, "Requested"),
    (TRIP_STATUS_ASSIGNED, "Assigned"),
    (TRIP_STATUS_ACCEPTED, "Accepted"),
    (TRIP_STATUS_REJECTED, "Rejected"),
    (TRIP_STATUS_ARRIVED, "Arrived"),
    (TRIP_STATUS_ACTIVE, "Active"),
    (TRIP_STATUS_COMPLETED, "Completed"),
    (TRIP_STATUS_CANCELLED, "Cancelled"),
)


# Boarding Request Status

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


# Dispatch Modes

DISPATCH_MODE_DIRECT = "direct"
DISPATCH_MODE_BROADCAST = "broadcast"

DISPATCH_MODE_CHOICES = (
    (DISPATCH_MODE_DIRECT, "Direct Assignment"),
    (DISPATCH_MODE_BROADCAST, "Broadcast Assignment"),
)


TRACKING_EXCHANGE = "tracking"  # Kept for backward compatibility; prefer EXCHANGE_TRIP from communication.constants

TRIP_STARTED = "trip.started"
TRIP_COMPLETED = "trip.completed"
TRIP_LOCATION = "trip.location"

BOARDING_EXCHANGE = "boarding"

BOARDING_CREATED_KEY = "request.created"
BOARDING_CANCELLED_KEY = "request.cancelled"
BOARDING_BOARDED_KEY = "request.boarded"
