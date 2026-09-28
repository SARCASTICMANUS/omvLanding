"""
Object-level ownership for trip-scoped resources.

Before this module, every ``/trips/<uuid>/`` and ``/vehicles/<uuid>/`` endpoint
authenticated the caller and then trusted the UUID in the URL. Any logged-in
user could read (or worse, mutate) another passenger's trip, another driver's
vehicle, or another passenger's boarding request simply by guessing or
harvesting an id.

``HasTripOwnership`` resolves the object named by the URL kwarg once, then
admits exactly three principals:

* the **passenger** on the trip (a ``BoardingRequest`` links them),
* the **assigned driver** of the trip or vehicle,
* a **city admin of the trip's city** (plus platform admins/staff).

The resolved object is cached on the view as ``_owned_object`` so handlers can
reuse the exact instance that was authorised instead of re-querying by id,
which removes the window where an object could be swapped between the
permission check and the mutation.

Usage::

    class TripDetail(APIView):
        permission_classes = [IsAuthenticated, HasTripAccess]

Subclass and set ``model``/``lookup_kwarg`` rather than hand-rolling another
``has_permission``.
"""

from rest_framework.exceptions import NotFound
from rest_framework.permissions import BasePermission

from common.constants import ROLE_ADMIN
from operations.models import ActiveTrip, BoardingRequest, Vehicle

# Not in User.role choices yet (see common.constants.ROLE_CHOICES) but it is
# already part of the permission vocabulary in accounts.permissions
# (IsCityAdmin / IsAdminOrCityAdmin). Kept here so the per-object rule is
# already correct on the day the role becomes assignable, and so this module
# agrees with that vocabulary instead of inventing a third notion of "admin".
ROLE_CITY_ADMIN = "city_admin"


class HasTripOwnership(BasePermission):
    """
    Base ownership check. Resolve ``model`` by the ``lookup_kwarg`` URL kwarg
    and admit only trip participants.

    Subclasses set ``model`` and ``lookup_kwarg``; the access rules below are
    shared by all of them.
    """

    #: Model resolved from the URL.
    model = None
    #: URL kwarg holding the primary key, e.g. ``trip_id`` in ``trips/<uuid:trip_id>/``.
    lookup_kwarg = None
    #: View attribute the resolved object is cached on.
    cache_attr = "_owned_object"

    message = "You do not have access to this resource."

    # ── DRF entry point ─────────────────────────────────────────────

    def has_permission(self, request, view):
        user = getattr(request, "user", None)
        if not user or not user.is_authenticated:
            return False

        if self.model is None or not self.lookup_kwarg:
            raise ValueError(
                f"{type(self).__name__} must define 'model' and 'lookup_kwarg'."
            )

        pk = (getattr(view, "kwargs", None) or {}).get(self.lookup_kwarg)
        if not pk:
            # The route carries no object id (e.g. trips/start/ takes the trip
            # in the body). There is nothing to own, so object-level scoping is
            # not this permission's job.
            return True

        obj = self._resolve(pk)
        if obj is None:
            # 404 rather than 403 so an unauthenticated-by-ownership caller
            # cannot use the status code to probe which ids exist.
            raise NotFound("Not found.")

        setattr(view, self.cache_attr, obj)

        return (
            self._is_platform_admin(user)
            or self._is_city_admin(user, obj)
            or self._is_participant(user, obj)
        )

    # ── resolution ──────────────────────────────────────────────────

    def _resolve(self, pk):
        qs = self.model.objects.all()
        if self.model is ActiveTrip:
            # route is needed for the city check; boarding_requests for the
            # passenger check, so both are fetched with the trip.
            qs = qs.select_related("route", "vehicle").prefetch_related("boarding_requests")
        elif self.model is BoardingRequest:
            qs = qs.select_related("trip__route")
        elif self.model is Vehicle:
            qs = qs.select_related("route", "city")
        return qs.filter(id=pk).first()

    # ── principals ──────────────────────────────────────────────────

    @staticmethod
    def _is_platform_admin(user):
        """Platform admins and staff oversee every city."""
        return bool(user.is_staff) or user.role == ROLE_ADMIN

    def _is_city_admin(self, user, obj):
        """
        City admin of the object's city.

        Scoped to ``User.city`` matching the object's city, so a city admin
        cannot read another city's trips. A user with no city set is never a
        city admin.
        """
        if user.role != ROLE_CITY_ADMIN or not user.city_id:
            return False
        return user.city_id == self._object_city_id(obj)

    def _is_participant(self, user, obj):
        """
        The passenger on the trip, or the driver assigned to it.

        ``ActiveTrip`` has no passenger column, so the only persisted link is
        ``BoardingRequest``. Every path that puts a passenger on a trip
        creates one: ``BoardingRequestCreateSerializer`` for the
        passenger-initiated flow and ``_assign_to_driver`` for dispatch. A trip
        with no boarding request is an operator-assigned empty trip (see
        ``DispatchService.assign_trip``), which has no passenger by definition
        and so admits only its driver and city admins.
        """
        if isinstance(obj, Vehicle):
            if obj.driver_id == user.id:
                return True
            # Keep live tracking working for a passenger riding this vehicle.
            return ActiveTrip.objects.filter(
                vehicle_id=obj.id,
                boarding_requests__passenger_id=user.id,
            ).exists()

        if isinstance(obj, BoardingRequest):
            if obj.passenger_id == user.id:
                return True
            return bool(obj.trip and obj.trip.driver_id == user.id)

        if obj.driver_id == user.id:
            return True
        return obj.boarding_requests.filter(passenger_id=user.id).exists()

    # ── helpers ─────────────────────────────────────────────────────

    @staticmethod
    def _object_city_id(obj):
        """
        City that owns the object, or ``None`` when it cannot be determined.

        Resolution order follows the schema: a trip's city is its route's city
        (ActiveTrip.route is non-null); a vehicle may carry its own city or
        inherit it from its route; a boarding request borrows its trip's.
        """
        if isinstance(obj, Vehicle):
            if obj.city_id:
                return obj.city_id
            return obj.route.city_id if obj.route_id and obj.route else None

        trip = obj.trip if isinstance(obj, BoardingRequest) else obj
        if trip is None or not trip.route_id or trip.route is None:
            return None
        return trip.route.city_id


class HasTripAccess(HasTripOwnership):
    """Ownership of an ``ActiveTrip`` at ``<uuid:trip_id>``."""

    model = ActiveTrip
    lookup_kwarg = "trip_id"
    message = "You do not have access to this trip."


class HasBoardingRequestAccess(HasTripOwnership):
    """Ownership of a ``BoardingRequest`` at ``<uuid:request_id>``."""

    model = BoardingRequest
    lookup_kwarg = "request_id"
    message = "You do not have access to this boarding request."


class HasVehicleAccess(HasTripOwnership):
    """
    Ownership of a ``Vehicle`` at ``<uuid:vehicle_id>``.

    Broader than "assigned driver": a passenger currently riding the vehicle
    is admitted too, because the live-tracking screens read vehicle state to
    render a trip they are a party to.
    """

    model = Vehicle
    lookup_kwarg = "vehicle_id"
    message = "You do not have access to this vehicle."
