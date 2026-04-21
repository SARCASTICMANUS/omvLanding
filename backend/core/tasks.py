# VAYY | core/tasks.py | Status: ✅ Public Transport Refactor
import random
import string
from celery import shared_task
from celery.utils.log import get_task_logger
from django.utils import timezone
from datetime import timedelta
from core.services.redis_service import get_redis_client, get_async_redis_client

logger = get_task_logger(__name__)


# ─── Location Sync ────────────────────────────────────────────────────────────


@shared_task(name="core.tasks.sync_locations_to_db")
def sync_locations_to_db():
    """
    Periodically sync high-frequency location data from Redis GEO sets to PostGIS.
    Batching writes every 2 minutes for system performance.
    """
    from django.contrib.gis.geos import Point

    # Updated to new Public models
    from core.models import ActiveTrip, PublicPassengerProfile

    r = get_async_redis_client()  # get_redis_client()

    # ── 1. Sync Active Trip positions (Drivers) ──────────────────────────────
    cursor = 0
    trip_synced = 0
    while True:
        cursor, members = r.zscan("active_trips_locations", cursor=cursor, count=100)
        for trip_id_raw, _ in members:
            if isinstance(trip_id_raw, bytes):
                trip_id = trip_id_raw.decode()
            else:
                trip_id = trip_id_raw

            if not r.exists(f"driver_pos:{trip_id}"):
                r.zrem("active_trips_locations", trip_id)
                continue

            positions = r.geopos("active_trips_locations", trip_id)
            if positions and positions[0]:
                lon, lat = positions[0]
                # 1. Update ActiveTrip
                updated = ActiveTrip.objects.filter(id=trip_id).update(
                    current_location=Point(float(lon), float(lat), srid=4326),
                    last_updated=timezone.now(),
                )

                if updated:
                    # 2. Calculate and Sync Schedule Delay
                    trip = ActiveTrip.objects.select_related(
                        "trip_schedule", "vehicle"
                    ).get(id=trip_id)
                    if trip.trip_schedule and trip.vehicle:
                        from core.models import VehicleState, StopTime
                        from django.contrib.gis.db.models.functions import Distance

                        p_point = Point(float(lon), float(lat), srid=4326)
                        nearest_stop_time = (
                            StopTime.objects.filter(trip_schedule=trip.trip_schedule)
                            .annotate(distance=Distance("stop__location", p_point))
                            .order_by("distance")
                            .first()
                        )

                        delay = 0
                        if nearest_stop_time:
                            now = timezone.now().time()
                            sched = nearest_stop_time.arrival_time
                            now_mins = now.hour * 60 + now.minute
                            sched_mins = sched.hour * 60 + sched.minute
                            delay = now_mins - sched_mins

                        v_state, _ = VehicleState.objects.get_or_create(
                            vehicle=trip.vehicle
                        )
                        v_state.active_trip = trip
                        v_state.delay_minutes = delay
                        v_state.save()

                    # 3. Geofencing: Notify passengers when bus is near their pickup stop
                    from core.models import BoardingRequest
                    from channels.layers import get_channel_layer
                    from asgiref.sync import async_to_sync
                    import json

                    # Find pending requests for this trip where pickup stop is within 500m
                    p_point = Point(float(lon), float(lat), srid=4326)
                    approaching_reqs = BoardingRequest.objects.filter(
                        trip_id=trip_id,
                        status="pending",
                        pickup_stop__location__dwithin=(
                            p_point,
                            0.005,
                        ),  # ~500m in degrees approx
                    ).select_related("passenger", "pickup_stop")

                    channel_layer = get_channel_layer()
                    for req in approaching_reqs:
                        req.status = "approaching"
                        req.save()

                        # Notify specific passenger
                        if channel_layer:
                            # We assume passengers join a user-specific group: user_{id}
                            async_to_sync(channel_layer.group_send)(
                                f"user_{req.passenger_id}",
                                {
                                    "type": "proximity_alert",
                                    "trip_id": str(trip_id),
                                    "stop_name": req.pickup_stop.name,
                                    "message": f"Your bus (Route {req.trip.route.bus_number}) is 500m away, please stand at the stop!",
                                },
                            )
                            # Also trigger manifest update for driver to see "approaching" status
                            from core.tasks import update_driver_manifest

                            update_driver_manifest.delay(str(trip_id))

                    trip_synced += 1
        if cursor == 0:
            break

    # ── 2. Sync Passenger positions ──────────────────────────────────────────
    cursor = 0
    passenger_synced = 0
    while True:
        # Consumer now uses 'passenger_locations'
        cursor, members = r.zscan("passenger_locations", cursor=cursor, count=100)
        for user_id_raw, _ in members:
            if isinstance(user_id_raw, bytes):
                user_id = user_id_raw.decode()
            else:
                user_id = user_id_raw

            # Consumer sets passenger_last_active:{id}
            if not r.exists(f"passenger_last_active:{user_id}"):
                r.zrem("passenger_locations", user_id)
                continue

            positions = r.geopos("passenger_locations", user_id)
            if positions and positions[0]:
                lon, lat = positions[0]
                updated = PublicPassengerProfile.objects.filter(user_id=user_id).update(
                    current_location=Point(float(lon), float(lat), srid=4326),
                    last_active_at=timezone.now(),
                )
                if updated:
                    passenger_synced += 1

        if cursor == 0:
            break

    logger.info(f"Sync complete: {trip_synced} trips, {passenger_synced} passengers")
    return {"status": "synced", "trips": trip_synced, "passengers": passenger_synced}


# ─── Hybrid Signal Processing ─────────────────────────────────────────────────


@shared_task(name="core.tasks.resolve_hybrid_location")
def resolve_hybrid_location():
    """
    Consumes from raw_signal_stream, resolves cell/wifi signals to lat/lon via MLS,
    applies Kalman Filter smoothing, and updates the vehicle's real-time position.
    """
    import json
    from core.models import HybridLog
    from core.utils import (
        resolve_hybrid_location_external,
        process_gps_update,
        KalmanFilter,
    )

    r = get_async_redis_client()  # get_redis_client()

    # Read up to 100 items from the stream
    messages = r.xread({"raw_signal_stream": "0-0"}, count=50)

    resolved_count = 0
    if messages:
        for stream, msgs in messages:
            for msg_id, payload in msgs:
                try:

                    def get_val(key):
                        # Try both bytes and string keys for robustness
                        v = payload.get(key)
                        if v is None:
                            v = payload.get(
                                key.decode() if isinstance(key, bytes) else key
                            )
                        if isinstance(v, bytes):
                            return v.decode()
                        return v

                    user_id = get_val("user_id")
                    trip_id = get_val("trip_id") or ""
                    cell_towers = json.loads(get_val("cell_towers") or "[]")
                    wifi_aps = json.loads(get_val("wifi_aps") or "[]")
                    device_id = get_val("device_id") or ""
                    ts_raw = get_val("timestamp")
                    ts_float = float(ts_raw) if ts_raw else timezone.now().timestamp()
                    timestamp = timezone.datetime.fromtimestamp(
                        ts_float, tz=timezone.utc
                    )

                    # 1. Log the raw signals
                    HybridLog.objects.create(
                        user_id=user_id,
                        trip_id=trip_id if trip_id else None,
                        cell_towers=cell_towers,
                        wifi_aps=wifi_aps,
                        device_id=device_id,
                        timestamp=timestamp,
                    )

                    # 2. Resolve to Lat/Lon
                    location_data = resolve_hybrid_location_external(
                        cell_towers, wifi_aps
                    )

                    if location_data and trip_id:
                        # 3. Apply Kalman Filter Smoothing
                        kf = KalmanFilter()

                        # Fetch last known state from Redis
                        kf_state_key = f"kf_state:{trip_id}"
                        last_state_raw = r.get(kf_state_key)

                        if last_state_raw:
                            ls = json.loads(last_state_raw)
                            kf.set_state(
                                ls["lat"], ls["lon"], ls["velocity"], ls["heading"]
                            )

                            # Calculate dt from last_timestamp
                            last_ts = ls.get("timestamp", ts_float - 1.0)
                            dt = max(0.1, ts_float - last_ts)
                            kf.predict(current_dt=dt)
                        else:
                            # Initialize with first measurement
                            kf.set_state(location_data["lat"], location_data["lon"])

                        # Update with new measurement
                        kf.update(location_data["lat"], location_data["lon"])
                        smoothed = kf.get_state()
                        smoothed["timestamp"] = (
                            ts_float  # Store current timestamp in state
                        )

                        # Save new state to Redis
                        r.set(kf_state_key, json.dumps(smoothed), ex=3600)

                        # 4. Trigger GPS update logic with smoothed coordinate
                        process_gps_update(
                            trip_id=trip_id,
                            lat=smoothed["lat"],
                            lon=smoothed["lon"],
                            source="hybrid_smoothed",
                        )
                        resolved_count += 1

                    # 5. Remove from stream after processing
                    r.xdel("raw_signal_stream", msg_id)

                except Exception as e:
                    logger.error(f"Error in resolve_hybrid_location for {msg_id}: {e}")

    return {"resolved": resolved_count}


@shared_task(name="core.tasks.update_driver_manifest")
def update_driver_manifest(trip_id):
    """
    Recalculates the Redis manifest and broadcasts
    the updated state to the driver via WebSockets.
    """
    from core.services.manifest import ManifestManager
    from core.models import BoardingRequest
    from core.api.serializers import BoardingRequestSerializer
    from channels.layers import get_channel_layer
    from asgiref.sync import async_to_sync

    try:
        # 1. Recalculate Redis Manifest (Stops with boarders)
        mm = ManifestManager()
        mm.recalculate_manifest(trip_id)
        redis_manifest = mm.get_manifest(trip_id)

        # 2. Fetch full list for legacy WebSocket clients or detailed view
        requests = BoardingRequest.objects.filter(
            trip_id=trip_id, status__in=["pending", "approaching", "boarded"]
        ).select_related("passenger", "pickup_stop")

        serializer = BoardingRequestSerializer(requests, many=True)
        manifest_data = serializer.data

        # 3. Broadcast updated manifest
        channel_layer = get_channel_layer()
        if channel_layer:
            payload = {
                "type": "manifest_update",
                "trip_id": str(trip_id),
                "manifest": manifest_data,  # Legacy detailed list
                "redis_manifest": redis_manifest,  # New aggregated list
                "total_pending": requests.filter(status="pending").count(),
                "total_boarded": requests.filter(status="boarded").count(),
            }

            # Broadcast to Trip Group (Legacy/Shared)
            async_to_sync(channel_layer.group_send)(f"trip_{trip_id}", payload)

            # Broadcast to dedicated Driver Manifest group
            trip = ActiveTrip.objects.select_related("vehicle").get(id=trip_id)
            if trip.vehicle:
                async_to_sync(channel_layer.group_send)(
                    f"manifest_{trip.vehicle_id}", payload
                )
        return {"status": "success", "trip_id": str(trip_id)}
    except Exception as e:
        logger.error(f"Error updating driver manifest for trip {trip_id}: {e}")
        return {"status": "error", "message": str(e)}


# ─── OTP Task ─────────────────────────────────────────────────────────────────


@shared_task(name="core.tasks.send_otp_async")
def send_otp_async(user_id):
    """Generate a 6-digit OTP, persist it, and email to the user."""
    from django.contrib.auth import get_user_model
    from django.core.mail import send_mail

    User = get_user_model()
    logger.info(f"[OTP] Sending OTP to user {user_id}")
    try:
        user = User.objects.get(id=user_id)
        logger.info(f"[OTP] User found: {user.email}")
    except User.DoesNotExist:
        logger.error(f"[OTP] User {user_id} not found")
        return {"status": "error", "reason": f"User {user_id} not found"}

    otp = 123456  # "".join(random.choices(string.digits, k=6))
    logger.info(f"[OTP] Generated code {otp} for {user.email}")
    user.otp = otp
    user.otp_verified = False
    user.otp_created_at = timezone.now()
    user.save(update_fields=["otp", "otp_verified", "otp_created_at"])

    try:
        send_mail(
            subject="Your Vayy Verification Code",
            message=f"Your Vayy verification code is: {otp}\n\nExpires in 10 minutes.\n\nIf you did not request this, please ignore.",
            from_email="noreply@vayy.app",
            recipient_list=[user.email],
            fail_silently=False,
        )
        logger.info(f"[OTP] Email sent to {user.email}")
    except Exception as e:
        logger.error(f"[OTP] Email delivery failed for {user.email}: {e}")

    return {"status": "sent"}


# ─── Cleanup Tasks ────────────────────────────────────────────────────────────


@shared_task(name="core.tasks.cleanup_inactive_trips")
def cleanup_inactive_trips():
    """Every 60 s: mark trips inactive if last_updated < now − 90 s."""
    from core.models import ActiveTrip

    threshold = timezone.now() - timedelta(seconds=90)
    updated = ActiveTrip.objects.filter(
        status="active",
        last_updated__lt=threshold,
    ).update(status="inactive")
    return {"deactivated": updated}


@shared_task(name="core.tasks.cleanup_stale_passengers")
def cleanup_stale_passengers():
    """Maintenance task for passenger location health."""
    return {"status": "ok"}
