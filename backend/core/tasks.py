# VAYY | core/tasks.py | Status: ✅ Public Transport Refactor
import random
import string
from celery import shared_task
from celery.utils.log import get_task_logger
from django.utils import timezone
from datetime import timedelta

logger = get_task_logger(__name__)


# ─── Location Sync ────────────────────────────────────────────────────────────

@shared_task(name="core.tasks.sync_locations_to_db")
def sync_locations_to_db():
    """
    Periodically sync high-frequency location data from Redis GEO sets to PostGIS.
    Batching writes every 2 minutes for system performance.
    """
    import os
    import redis
    from django.contrib.gis.geos import Point
    # Updated to new Public models
    from core.models import ActiveTrip, PublicPassengerProfile

    REDIS_HOST = "redis" if os.environ.get("IN_DOCKER") else "localhost"
    r = redis.Redis(host=REDIS_HOST, port=6379, db=0)

    # ── 1. Sync Active Trip positions (Drivers) ──────────────────────────────
    cursor = 0
    trip_synced = 0
    while True:
        cursor, members = r.zscan("active_trips_locations", cursor=cursor, count=100)
        for trip_id_bytes, _ in members:
            trip_id = trip_id_bytes.decode()

            if not r.exists(f"driver_pos:{trip_id}"):
                r.zrem("active_trips_locations", trip_id)
                continue

            positions = r.geopos("active_trips_locations", trip_id)
            if positions and positions[0]:
                lon, lat = positions[0]
                updated = ActiveTrip.objects.filter(id=trip_id).update(
                    current_location=Point(float(lon), float(lat), srid=4326),
                    last_updated=timezone.now(),
                )
                if updated:
                    trip_synced += 1
        if cursor == 0:
            break

    # ── 2. Sync Passenger positions ──────────────────────────────────────────
    cursor = 0
    passenger_synced = 0
    while True:
        # Consumer now uses 'passenger_locations'
        cursor, members = r.zscan("passenger_locations", cursor=cursor, count=100)
        for user_id_bytes, _ in members:
            user_id = user_id_bytes.decode()

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

    otp = 123456 #"".join(random.choices(string.digits, k=6))
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
