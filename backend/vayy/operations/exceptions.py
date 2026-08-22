class OperationsException(Exception):
    pass


class VehicleNotFound(
    OperationsException
):
    pass


class TripNotFound(
    OperationsException
):
    pass


class BoardingRequestNotFound(
    OperationsException
):
    pass


class DriverAlreadyAssigned(
    OperationsException
):
    pass


class VehicleAlreadyAssigned(
    OperationsException
):
    pass


class ActiveTripExists(
    OperationsException
):
    pass


class BoardingRequestExists(
    OperationsException
):
    pass