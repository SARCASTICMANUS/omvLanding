from rest_framework.permissions import BasePermission
from common.constants import (
    ROLE_ADMIN,
    ROLE_PASSENGER,
    ROLE_BIKE_DRIVER,
    ROLE_AUTO_DRIVER,
)


class IsAdmin(BasePermission):
    """
    System Admin only.
    """

    message = "Admin access required."

    def has_permission(self, request, view):
        return (
            request.user.is_authenticated
            and (
                request.user.role == ROLE_ADMIN
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
            in [ROLE_BIKE_DRIVER, ROLE_AUTO_DRIVER]
        )


class IsPassenger(BasePermission):
    """
    Passenger only.
    """

    message = "Passenger access required."

    def has_permission(self, request, view):
        return (
            request.user.is_authenticated
            and request.user.role == ROLE_PASSENGER
        )


class IsAdminOrCityAdmin(BasePermission):
    """
    Admin OR City Admin.
    """

    message = "Admin or City Admin access required."

    def has_permission(self, request, view):
        return (
            request.user.is_authenticated
            and request.user.role in [ROLE_ADMIN, "city_admin"]
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
            in [ROLE_BIKE_DRIVER, ROLE_AUTO_DRIVER, ROLE_ADMIN]
        )


class IsPassengerOrAdmin(BasePermission):
    """
    Passenger OR Admin.
    """

    message = "Passenger or Admin access required."

    def has_permission(self, request, view):
        return (
            request.user.is_authenticated
            and request.user.role in [ROLE_PASSENGER, ROLE_ADMIN]
        )
