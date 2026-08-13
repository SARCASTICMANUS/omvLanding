from rest_framework.permissions import BasePermission


class IsAdmin(BasePermission):
    """
    System Admin only.
    """

    message = "Admin access required."

    def has_permission(self, request, view):
        return (
            request.user.is_authenticated
            and (
                request.user.role == "admin"
                or request.user.is_staff
            )
        )


class IsCityAdmin(BasePermission):
    """
    City Admin only.
    """

    message = "City admin access required."

    def has_permission(self, request, view):
        return (
            request.user.is_authenticated
            and request.user.role == "city_admin"
        )


class IsDriver(BasePermission):
    """
    Driver only.
    """

    message = "Driver access required."

    def has_permission(self, request, view):
        return (
            request.user.is_authenticated
            and request.user.role
            in ["bikedriver", "autodriver"]
        )


class IsPassenger(BasePermission):
    """
    Passenger only.
    """

    message = "Passenger access required."

    def has_permission(self, request, view):
        return (
            request.user.is_authenticated
            and request.user.role == "passenger"
        )


class IsAdminOrCityAdmin(BasePermission):
    """
    Admin OR City Admin.
    """

    message = "Admin or City Admin access required."

    def has_permission(self, request, view):
        return (
            request.user.is_authenticated
            and request.user.role in ["admin", "city_admin"]
        )


class IsDriverOrAdmin(BasePermission):
    """
    Driver OR Admin.
    """

    message = "Driver or Admin access required."

    def has_permission(self, request, view):
        return (
            request.user.is_authenticated
            and request.user.role
            in ["bikedriver", "autodriver", "admin"]
        )


class IsPassengerOrAdmin(BasePermission):
    """
    Passenger OR Admin.
    """

    message = "Passenger or Admin access required."

    def has_permission(self, request, view):
        return (
            request.user.is_authenticated
            and request.user.role in ["passenger", "admin"]
        )
