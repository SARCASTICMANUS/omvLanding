import logging
from typing import Any, Dict, List, Optional, Tuple

from django.contrib.gis.geos import Point
from django.db import transaction
from django.utils import timezone
from rest_framework.exceptions import PermissionDenied, ValidationError

from accounts.models import User
from common.constants import (
    JOURNEY_PATH_POINT_LIMIT,
    TRIP_STATUS_ACTIVE,
    TRIP_STATUS_CANCELLED,
    TRIP_STATUS_COMPLETED,
    ROLE_AUTO_DRIVER,
    ROLE_BIKE_DRIVER,
)
from operations.models import ActiveTrip, Vehicle, VehicleState
from tracking.services.corridor_service import CorridorService
from tracking.services.journey_cache_service import JourneyCacheService

logger = logging.getLogger(__name__)

DRIVER_ROLES = (ROLE_BIKE_DRIVER, ROLE_AUTO_DRIVER)

# Trip statuses that mean the vehicle is already committed and cannot start a
# second journey.
BLOCKING_STATUSES = (TRIP_STATUS_ACTIVE,)


class JourneyService:
    """
    Free-form driver journeys: origin -> destination, no fixed route.

    A journey is started when the driver declares both endpoints. The server
    builds one direct OSRM road path between them, attaches the admin-managed
    global stops that fall within the corridor around that path (ordered
    nearest-first from the origin), and holds both in Redis until the journey
    ends.

    The path is mandatory. A journey whose geometry could not be resolved has no
    value: it cannot be snapped to, cannot be matched against stops, and cannot
    be driven or drawn. So an OSRM failure ends the request rather than starting
    a trip that would look live and serve nobody.
    """

    # ── start ──────────────────────────────────────────────────

    @classmethod
    def start_journey(
        cls,
        driver: User,
        vehicle_id: str,
        origin: Tuple[float, float],
        destination: Tuple[float, float],
        origin_name: str = "",
        destination_name: str = "",
    ) -> Dict[str, Any]:
        """
        Start a journey for a driver.

        ``origin``/``destination`` are (lat, lng). Returns the created trip plus
        the path and ordered stops so the driver app can render the journey
        immediately.
        """
        vehicle = cls._resolve_vehicle(driver, vehicle_id)
        cls._assert_no_active_trip(vehicle)

        origin = cls._validate_point(origin, "origin")
        destination = cls._validate_point(destination, "destination")
        if cls._haversine_m(origin, destination) < 100:
            raise ValidationError(
                {"destination": "Destination is too close to the starting point."}
            )

        # Road path is mandatory; a None here means OSRM could not route.
        path_result = cls._build_path(origin, destination)
        if not path_result:
            raise ValidationError(
                {
                    "destination": (
                        "Could not build a road route between these points. "
                        "Pick a point on a road and try again."
                    )
                }
            )

        coords_latlng, distance_m, duration_s = path_result
        # The path document is stored [lat, lng] for the clients, but
        # CorridorService works in (lng, lat) to match PostGIS's x/y ordering.
        coords_lnglat = [(c[1], c[0]) for c in coords_latlng]

        # Global stops near the path, nearest-first from the origin.
        ordered_stops = CorridorService.stops_on_path(coords_lnglat)

        trip = cls._create_trip(
            vehicle=vehicle,
            driver=driver,
            origin=origin,
            destination=destination,
            origin_name=origin_name,
            destination_name=destination_name,
            distance_m=distance_m,
            duration_s=duration_s,
        )

        # The cache write is the commit point for the journey. If it fails the
        # trip is a row nobody can serve, so it is rolled back rather than left
        # dangling: a half-live journey would keep showing in passing-vehicle
        # lookups' trip ids and never be cleanable per-stop.
        cached = JourneyCacheService.save_journey(
            trip_id=str(trip.id),
            path_coords=coords_latlng,
            distance_m=distance_m,
            duration_s=duration_s,
            origin=origin,
            destination=destination,
            ordered_stops=ordered_stops,
        )
        if not cached:
            cls._abort_trip(trip, "journey cache unavailable")
            raise ValidationError(
                {"detail": "Could not initialise the journey. Please try again."}
            )

        cls._attach_vehicle_state(trip, vehicle, coords_latlng[0])

        logger.info(
            "Journey started: trip=%s driver=%s stops=%d distance=%.0fm",
            trip.id,
            driver.id,
            len(ordered_stops),
            distance_m,
        )

        return {
            "trip_id": str(trip.id),
            "status": trip.status,
            "path": coords_latlng,
            "distance_m": round(distance_m, 1),
            "duration_s": round(duration_s, 1),
            "origin": {"lat": origin[0], "lng": origin[1], "name": origin_name},
            "destination": {
                "lat": destination[0],
                "lng": destination[1],
                "name": destination_name,
            },
            "stops": ordered_stops,
            # Carried on the start response too, so the live screen has the
            # vehicle for its GPS push without a second round trip.
            **cls._vehicle_identity(trip),
        }

    # ── preview ────────────────────────────────────────────────

    @classmethod
    def preview_journey(
        cls,
        driver: User,
        origin: Tuple[float, float],
        destination: Tuple[float, float],
    ) -> Dict[str, Any]:
        """
        Resolve the road path and its global stops without starting anything.

        Same routing and corridor rules as ``start_journey`` so the preview the
        driver approves is the journey they get: no ActiveTrip row, no Redis
        document, no vehicle state change. Lets the app show the road and its
        stops on the same screen before the driver commits.

        ``origin``/``destination`` are (lat, lng).
        """
        if driver.role not in DRIVER_ROLES:
            raise PermissionDenied("Only drivers can preview a journey.")

        origin = cls._validate_point(origin, "origin")
        destination = cls._validate_point(destination, "destination")
        too_close = cls._haversine_m(origin, destination) < 100
        if too_close:
            raise ValidationError(
                {"destination": "Destination is too close to the starting point."}
            )

        path_result = cls._build_path(origin, destination)
        if not path_result:
            raise ValidationError(
                {
                    "destination": (
                        "Could not build a road route between these points. "
                        "Pick a point on a road and try again."
                    )
                }
            )

        coords_latlng, distance_m, duration_s = path_result
        coords_lnglat = [(c[1], c[0]) for c in coords_latlng]
        ordered_stops = CorridorService.stops_on_path(coords_lnglat)

        logger.info(
            "Journey preview: driver=%s stops=%d distance=%.0fm",
            driver.id,
            len(ordered_stops),
            distance_m,
        )

        return {
            "path": coords_latlng,
            "distance_m": round(distance_m, 1),
            "duration_s": round(duration_s, 1),
            "origin": {"lat": origin[0], "lng": origin[1]},
            "destination": {"lat": destination[0], "lng": destination[1]},
            "stops": ordered_stops,
        }

    # ── end ────────────────────────────────────────────────────

    @classmethod
    def end_journey(
        cls,
        trip_id: str,
        user: User,
        cancel: bool = False,
    ) -> Dict[str, Any]:
        """
        End a journey: settle what is owed, free the vehicle, drop the Redis
        documents.

        The driver ends their own journey; passengers withdraw from their own
        boarding instead (see DispatchService.cancel_broadcast_request), so
        authorisation here is driver-only.
        """
        trip = cls._get_journey_trip(trip_id)

        if trip.driver_id != user.id:
            raise PermissionDenied("Only the assigned driver can end this journey.")

        if trip.status in (TRIP_STATUS_COMPLETED, TRIP_STATUS_CANCELLED):
            # Idempotent: a retry after a client timeout must not fail, and must
            # not double-settle.
            return {
                "trip_id": str(trip.id),
                "status": trip.status,
                "already_ended": True,
            }

        from operations.services.dispatch_service import DispatchService

        settlement = {"total": 0, "settled": [], "outstanding": []}

        with transaction.atomic():
            trip.status = TRIP_STATUS_CANCELLED if cancel else TRIP_STATUS_COMPLETED
            trip.ended_at = timezone.now()
            journey_distance = trip.total_distance_m
            trip.save(update_fields=["status", "ended_at", "last_updated"])

            if not cancel:
                settlement = DispatchService.settle_journey_passengers(trip)

            state, _ = VehicleState.objects.get_or_create(vehicle=trip.vehicle)
            state.active_trip = None
            state.current_stop_index = 0
            state.current_segment_index = 0
            state.distance_along_route_m = 0
            state.save(
                update_fields=[
                    "active_trip",
                    "current_stop_index",
                    "current_segment_index",
                    "distance_along_route_m",
                ]
            )

        JourneyCacheService.delete_journey(str(trip.id))

        # Tell the passengers on this trip that it is over, so their fare screen
        # can show the settled segment without them having to go looking for it.
        # Best-effort: the journey is already committed and the fares already
        # recorded, so a failed notification must not undo either.
        cls._notify_trip_completed(trip, settlement, cancel)

        logger.info(
            "Journey ended: trip=%s driver=%s status=%s distance=%s",
            trip.id,
            user.id,
            trip.status,
            journey_distance,
        )

        # Each rider settled on their own pickup→drop segment, so the driver is
        # shown per-passenger fares rather than one figure for the whole run.
        settled_fares = settlement.get("settled") or []
        return {
            "trip_id": str(trip.id),
            "status": trip.status,
            "distance_m": journey_distance,
            "passenger_count": settlement.get("total", 0),
            "passengers": settled_fares,
            "total_fare": round(
                sum(float(p.get("fare") or 0) for p in settled_fares), 2
            ),
            # Passengers whose debit failed. Surfaced so the driver is not shown
            # a clean-looking summary while revenue is still outstanding.
            "outstanding": settlement.get("outstanding") or [],
        }

    @classmethod
    def _notify_trip_completed(
        cls,
        trip: ActiveTrip,
        settlement: Dict[str, Any],
        cancel: bool,
    ) -> None:
        """
        Announce the journey's end on the trip socket.

        One message carries every rider's settled segment rather than a message
        per passenger: the app keys its trip socket by trip id, so every rider on
        this journey is on the same channel and reads the entry that is theirs.
        """
        try:
            from asgiref.sync import async_to_sync
            from channels.layers import get_channel_layer

            async_to_sync(get_channel_layer().group_send)(
                f"trip_{trip.id}",
                {
                    "type": "trip_update",
                    "data": {
                        "type": "trip_completed",
                        "trip_id": str(trip.id),
                        "status": trip.status,
                        "cancelled": bool(cancel),
                        "passengers": settlement.get("settled") or [],
                        "outstanding": settlement.get("outstanding") or [],
                    },
                },
            )
        except Exception as exc:
            # The trip is already ended and the money already moved; failing to
            # announce it must not surface as an error on an operation that
            # succeeded.
            logger.warning(
                "Journey completion notice failed for trip %s: %s", trip.id, exc
            )

    @classmethod
    def get_active_journey_for_driver(cls, driver: User) -> Optional[Dict[str, Any]]:
        """
        The driver's in-progress journey, if there is one.

        Lets the app answer "do I need to put this driver back on their journey?"
        without knowing the trip id, which is the situation after a cold start: the
        id lives only in whatever the app last held in memory.

        Ordered newest-first so a driver who somehow has more than one open trip
        is returned their most recent rather than an arbitrary one.
        """
        if driver.role not in DRIVER_ROLES:
            return None

        trip = (
            ActiveTrip.objects.filter(
                driver=driver,
                status=TRIP_STATUS_ACTIVE,
                route__isnull=True,
            )
            .order_by("-started_at")
            .first()
        )
        if not trip:
            return None

        journey = cls.get_journey(str(trip.id))
        if journey:
            return journey

        # The trip row is open but its cached path is gone (Redis flush or TTL).
        # Report the trip with a degraded payload rather than "no journey", or the
        # app drops the driver onto a start screen while their trip is still
        # marked active and they are unable to end it.
        return {
            "trip_id": str(trip.id),
            "status": trip.status,
            "path": [],
            "stops": [],
            "distance_m": None,
            "duration_s": None,
            "origin": None,
            "destination": None,
            "degraded": True,
            **cls._vehicle_identity(trip),
        }

    @classmethod
    def _vehicle_identity(cls, trip: ActiveTrip) -> Dict[str, Any]:
        """
        Vehicle fields the app needs to resume.

        The driver app keys its GPS push and its notification channel on the
        vehicle, so these have to survive in the journey payload. Without them a
        resumed driver lands on the live screen but sends no location, and stops
        never see the vehicle passing.
        """
        return {
            "vehicle_id": str(trip.vehicle_id) if trip.vehicle_id else None,
            "vehicle_type": trip.vehicle.vehicle_type if trip.vehicle_id else None,
            "vehicle_number": trip.vehicle.vehicle_number if trip.vehicle_id else None,
            # The driver's own id. The live screen keys its notification
            # subscription on it, and without it in the payload the driver
            # never joined notifications_{id} - so a raised hand was delivered to
            # nobody and the driver saw no request at all.
            "driver_id": str(trip.driver_id) if trip.driver_id else None,
        }

    @classmethod
    def get_journey(cls, trip_id: str) -> Optional[Dict[str, Any]]:
        """Read-only view of a cached journey, for the driver app to rehydrate."""
        trip = (
            ActiveTrip.objects.filter(id=trip_id)
            .select_related("vehicle")
            .first()
        )
        if not trip or not trip.is_journey:
            return None

        journey = JourneyCacheService.get_journey(str(trip.id))
        if not journey:
            return None

        # Stops carry only geometry from the cache, so the driver's screen had
        # no arrival times and rendered "—". Enrich each one with the distance
        # and ETA left to it, measured against where the vehicle actually is.
        vehicle_pos = cls._vehicle_position(trip)
        stops = cls._stops_with_eta(str(trip.id), vehicle_pos)
        return {
            "trip_id": str(trip.id),
            "status": trip.status,
            "path": journey.get("path") or [],
            "distance_m": journey.get("distance_m"),
            "duration_s": journey.get("duration_s"),
            "origin": journey.get("origin"),
            "destination": journey.get("destination"),
            "stops": stops,
            "progress_m": CorridorService.progress_m(
                str(trip.id), vehicle_pos
            ),
            **cls._vehicle_identity(trip),
        }

    @classmethod
    def _vehicle_position(cls, trip: ActiveTrip):
        """The vehicle's last known position as (lng, lat), or None."""
        state = getattr(trip.vehicle, "state", None)
        loc = getattr(state, "current_location", None)
        if loc is None:
            return None
        return (loc.x, loc.y)

    @classmethod
    def _stops_with_eta(
        cls, trip_id: str, vehicle_pos=None
    ) -> List[Dict[str, Any]]:
        """
        The journey's ordered stops, each with its remaining distance and ETA.

        The cached stop entries hold geometry only. Everything the driver screen
        shows beyond a name - how far on, how long to get there - is derived here
        from the vehicle's live progress, so it updates as they drive rather
        than being frozen at journey start.
        """
        stops = JourneyCacheService.get_ordered_stops(trip_id)
        if not stops:
            return []

        journey = JourneyCacheService.get_journey(trip_id) or {}
        total = float(journey.get("distance_m") or 0)
        progress = CorridorService.progress_m(trip_id, vehicle_pos)

        enriched = []
        for stop in stops:
            dist_along = float(stop.get("dist_along_m") or 0)
            remaining = max(0.0, total - dist_along)
            eta_minutes = None
            if progress is not None and total > 0:
                # City-average speed, the same basis as CorridorService's own
                # ETA, so the numbers agree with the passenger-facing side.
                left = max(0.0, total - max(progress, dist_along))
                eta_minutes = max(1, round((left / 1000.0) / 30.0 * 60))
            enriched.append(
                {
                    **stop,
                    "distance_m": round(remaining, 1),
                    "eta_minutes": eta_minutes,
                    "is_next": (
                        progress is not None
                        and dist_along >= progress
                        and not any(
                            e["is_next"] for e in enriched
                        )
                    ),
                }
            )
        return enriched

    # ── internal helpers ───────────────────────────────────────

    @staticmethod
    def _haversine_m(p1: Tuple[float, float], p2: Tuple[float, float]) -> float:
        """Great-circle metres between two (lat, lng) points."""
        import math

        lon1, lat1 = math.radians(p1[1]), math.radians(p1[0])
        lon2, lat2 = math.radians(p2[1]), math.radians(p2[0])
        dlat = lat2 - lat1
        dlon = lon2 - lon1
        a = (
            math.sin(dlat / 2) ** 2
            + math.cos(lat1) * math.cos(lat2) * math.sin(dlon / 2) ** 2
        )
        return 2 * 6371000 * math.asin(math.sqrt(a))

    @staticmethod
    def _validate_point(point: Any, label: str) -> Tuple[float, float]:
        """Coerce to a (lat, lng) float pair, rejecting junk loudly."""
        try:
            lat = float(point[0])
            lng = float(point[1])
        except (TypeError, ValueError, IndexError, KeyError):
            raise ValidationError({label: "Provide both a latitude and a longitude."})
        if not (-90 <= lat <= 90) or not (-180 <= lng <= 180):
            raise ValidationError({label: "Coordinates are out of range."})
        return lat, lng

    @staticmethod
    def _build_path(
        origin: Tuple[float, float],
        destination: Tuple[float, float],
    ) -> Optional[Tuple[List[List[float]], float, float]]:
        """
        Direct OSRM road path from origin to destination.

        Returns ``([[lat, lng], ...], distance_m, duration_s)`` or None. No
        fallback to a straight line: the geometry is the journey, and a
        straight line between two arbitrary points is not a drivable path.
        """
        from transport.services.osrm_service import OSRMService

        result = OSRMService.get_road_path(
            origin=(origin[1], origin[0]),  # OSRM wants (lng, lat)
            destination=(destination[1], destination[0]),
        )
        if not result:
            logger.error(
                "OSRM returned no path for journey %s -> %s", origin, destination
            )
            return None

        geometry = result.get("geometry") or {}
        raw_coords = geometry.get("coordinates") or []
        if len(raw_coords) < 2:
            logger.error("OSRM path geometry had %d points", len(raw_coords))
            return None

        # OSRM emits (lng, lat); everything downstream of this service works in
        # (lat, lng), which is the order the mobile clients already use.
        coords_latlng = [[lat, lng] for lng, lat in raw_coords]

        if len(coords_latlng) > JOURNEY_PATH_POINT_LIMIT:
            # Thin rather than truncate: dropping the tail would shorten the
            # journey to somewhere the driver never asked to go.
            step = len(coords_latlng) / JOURNEY_PATH_POINT_LIMIT
            coords_latlng = [
                coords_latlng[int(i * step)]
                for i in range(JOURNEY_PATH_POINT_LIMIT)
            ] + [coords_latlng[-1]]

        distance_m = float(result.get("distance") or 0)
        duration_s = float(result.get("duration") or 0)
        if not distance_m:
            logger.error("OSRM path had zero distance for journey %s", origin)
            return None

        return coords_latlng, distance_m, duration_s

    @staticmethod
    def _resolve_vehicle(driver: User, vehicle_id: str) -> Vehicle:
        """The driver's own active vehicle. Drivers cannot start on another's."""
        if driver.role not in DRIVER_ROLES:
            raise PermissionDenied("Only drivers can start a journey.")

        try:
            vehicle = Vehicle.objects.select_related("city").get(
                id=vehicle_id, driver=driver
            )
        except Vehicle.DoesNotExist:
            raise ValidationError({"vehicle_id": "Vehicle not found for this driver."})

        if not vehicle.is_active:
            raise ValidationError({"vehicle_id": "Vehicle is not active."})

        return vehicle

    @staticmethod
    def _assert_no_active_trip(vehicle: Vehicle) -> None:
        """
        One journey per vehicle.

        Without this a second start would leave the first trip ACTIVE with its
        Redis documents intact: it would keep appearing as passing a stop while
        the vehicle drove a different path, and the first end call would delete
        the wrong journey.
        """
        existing = ActiveTrip.objects.filter(
            vehicle=vehicle, status__in=BLOCKING_STATUSES
        ).first()
        if existing:
            raise ValidationError(
                {"detail": "This vehicle already has an active journey."}
            )

    @staticmethod
    def _get_journey_trip(trip_id: str) -> ActiveTrip:
        trip = ActiveTrip.objects.select_related("vehicle", "driver").filter(
            id=trip_id
        ).first()
        if not trip:
            raise ValidationError({"trip_id": "Journey not found."})
        if not trip.is_journey:
            raise ValidationError({"trip_id": "This trip is not a journey."})
        return trip

    @staticmethod
    def _create_trip(
        vehicle: Vehicle,
        driver: User,
        origin: Tuple[float, float],
        destination: Tuple[float, float],
        origin_name: str,
        destination_name: str,
        distance_m: float,
        duration_s: float,
    ) -> ActiveTrip:
        return ActiveTrip.objects.create(
            vehicle=vehicle,
            route=None,  # journey: explicitly not on a fixed route
            trip_schedule=None,
            driver=driver,
            status=TRIP_STATUS_ACTIVE,
            origin_point=Point(origin[1], origin[0], srid=4326),
            destination_point=Point(destination[1], destination[0], srid=4326),
            origin_name=origin_name or "",
            destination_name=destination_name or "",
            total_distance_m=round(distance_m, 2),
            total_duration_s=round(duration_s, 2),
            started_at=timezone.now(),
        )

    @staticmethod
    def _abort_trip(trip: ActiveTrip, reason: str) -> None:
        """
        Mark a just-created trip cancelled.

        Used when the journey could not be fully initialised, so the trip never
        reaches a state a driver would see as rideable.
        """
        trip.status = TRIP_STATUS_CANCELLED
        trip.ended_at = timezone.now()
        trip.save(update_fields=["status", "ended_at", "last_updated"])
        logger.error("Journey %s aborted: %s", trip.id, reason)

    @staticmethod
    def _attach_vehicle_state(
        trip: ActiveTrip,
        vehicle: Vehicle,
        first_point: List[float],
    ) -> None:
        """Point VehicleState at the journey and seed it at the origin."""
        state, _ = VehicleState.objects.get_or_create(vehicle=vehicle)
        state.active_trip = trip
        state.current_stop_index = 0
        state.current_segment_index = 0
        state.distance_along_route_m = 0
        if state.current_location is None:
            state.current_location = Point(first_point[1], first_point[0], srid=4326)
        state.save(
            update_fields=[
                "active_trip",
                "current_stop_index",
                "current_segment_index",
                "distance_along_route_m",
                "current_location",
            ]
        )
