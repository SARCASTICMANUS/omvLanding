ROLE_PASSENGER = "passenger"
ROLE_BIKE_DRIVER = "bikedriver"
ROLE_AUTO_DRIVER = "autodriver"
ROLE_ADMIN = "admin"

ROLE_CHOICES = (
    (ROLE_PASSENGER, "Passenger"),
    (ROLE_BIKE_DRIVER, "Bike Driver"),
    (ROLE_AUTO_DRIVER, "Auto Admin"),
    (ROLE_ADMIN, "Admin"),
)

# ---

VEHICLE_BIKE = "bike"
VEHICLE_AUTO = "auto"

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