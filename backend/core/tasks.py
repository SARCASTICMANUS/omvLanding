# VAYY | core/tasks.py
import random
import string
from celery import shared_task
from django.utils import timezone
from datetime import timedelta


# ─── Location Sync ────────────────────────────────────────────────────────────

@shared_task(name="core.tasks.sync_locations_to_db")
def sync_locations_to_db():
    """
    Periodically sync high-frequency location data from Redis GEO sets to PostGIS.
    Reduces DB write pressure by batching writes every 2 minutes.

    NOTE: Uses ZSCAN instead of the deprecated GEORADIUS command (removed Redis 7.0+).
    """
    import os
    import redis
    from django.contrib.gis.geos import Point
    from core.models import ActiveTrip, StudentProfile

    REDIS_HOST = "redis" if os.environ.get("IN_DOCKER") else "localhost"
    r = redis.Redis(host=REDIS_HOST, port=6379, db=0)

    # ── 1. Sync Active Trip positions ────────────────────────────────────────
    # ZSCAN iterates the sorted set without blocking (unlike KEYS or GEORADIUS).
    cursor = 0
    trip_synced = 0
    while True:
        cursor, members = r.zscan("active_trips_locations", cursor=cursor, count=100)
        for trip_id_bytes, _ in members:
            trip_id = trip_id_bytes.decode()

            # Skip if driver disconnected (key expires in 30 s via consumer)
            if not r.exists(f"driver_pos:{trip_id}"):
                r.zrem("active_trips_locations", trip_id)
                continue

            # GEOPOS returns [(lon, lat)] or [None] for missing member
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

    # ── 2. Sync Student positions ────────────────────────────────────────────
    cursor = 0
    student_synced = 0
    while True:
        cursor, members = r.zscan("student_locations", cursor=cursor, count=100)
        for student_id_bytes, _ in members:
            student_id = student_id_bytes.decode()

            # TTL key set to 300 s in consumer; absence means student is stale
            if not r.exists(f"student_last_active:{student_id}"):
                r.zrem("student_locations", student_id)
                continue

            positions = r.geopos("student_locations", student_id)
            if positions and positions[0]:
                lon, lat = positions[0]
                updated = StudentProfile.objects.filter(user_id=student_id).update(
                    current_location=Point(float(lon), float(lat), srid=4326),
                    last_active_at=timezone.now(),
                )
                if updated:
                    student_synced += 1

        if cursor == 0:
            break

    return {"status": "synced", "trips": trip_synced, "students": student_synced}


# ─── OTP Task ─────────────────────────────────────────────────────────────────

@shared_task(name="core.tasks.send_otp_async")
def send_otp_async(user_id):
    """Generate a 6-digit OTP, persist it, and email to the user."""
    from django.contrib.auth import get_user_model
    from django.core.mail import send_mail

    User = get_user_model()
    try:
        user = User.objects.get(id=user_id)
    except User.DoesNotExist:
        return {"status": "error", "reason": f"User {user_id} not found"}

    otp = "".join(random.choices(string.digits, k=6))
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
    except Exception as e:
        # Log but don't fail — console backend prints in dev
        print(f"[OTP] Email delivery failed: {e}")

    print(f"[OTP] Code {otp} generated for {user.email}")
    return {"status": "sent"}


# ─── Cleanup Tasks ────────────────────────────────────────────────────────────

@shared_task(name="core.tasks.cleanup_inactive_trips")
def cleanup_inactive_trips():
    """
    Every 60 s: mark trips inactive if last_updated < now − 90 s.
    Handles driver disconnect / network drop without waiting for WS close.
    """
    from core.models import ActiveTrip

    threshold = timezone.now() - timedelta(seconds=90)
    updated = ActiveTrip.objects.filter(
        status="active",
        last_updated__lt=threshold,
    ).update(status="inactive")

    print(f"[Cleanup] Deactivated {updated} stale trip(s)")
    return {"deactivated": updated}


@shared_task(name="core.tasks.cleanup_stale_passengers")
def cleanup_stale_passengers():
    """
    Every 5 min: placeholder for future PassengerWait cleanup.
    Registered so the Beat schedule is valid.
    """
    return {"status": "ok"}


# ─── Bulk Upload Task ─────────────────────────────────────────────────────────

@shared_task(name="core.tasks.process_bulk_upload")
def process_bulk_upload(log_id, file_path):
    """
    Process a CSV/Excel student bulk-upload asynchronously.
    Updates BulkUploadLog with per-row success/error counts.
    """
    import csv
    import os
    from core.models import BulkUploadLog, Vehicle, StudentAssignment, StudentProfile
    from django.contrib.auth import get_user_model

    User = get_user_model()

    try:
        log = BulkUploadLog.objects.get(id=log_id)
    except BulkUploadLog.DoesNotExist:
        return {"status": "error", "reason": f"BulkUploadLog {log_id} not found"}

    REQUIRED_COLUMNS = {"student_name", "student_id", "email"}
    errors = []
    success_count = 0

    try:
        if file_path.endswith(".xlsx"):
            import openpyxl
            wb = openpyxl.load_workbook(file_path)
            ws = wb.active
            rows = list(ws.iter_rows(values_only=True))
            headers = [str(h).strip().lower() for h in rows[0]]
            data_rows = [dict(zip(headers, row)) for row in rows[1:]]
        else:
            with open(file_path, "r", encoding="utf-8") as f:
                reader = csv.DictReader(f)
                headers = [h.strip().lower() for h in (reader.fieldnames or [])]
                data_rows = [{k.strip().lower(): v for k, v in row.items()} for row in reader]

        missing = REQUIRED_COLUMNS - set(headers)
        if missing:
            log.errors = [{"row": 0, "reason": f"Missing columns: {', '.join(missing)}"}]
            log.error_count = 1
            log.save()
            return {"status": "error", "reason": "Missing required columns"}

        log.total_rows = len(data_rows)
        log.save(update_fields=["total_rows"])

        for idx, row in enumerate(data_rows, start=2):
            try:
                email = str(row.get("email", "")).strip()
                if not email:
                    raise ValueError("Email is required")

                user, created = User.objects.get_or_create(
                    email=email,
                    defaults={
                        "username": email,
                        "role": "student",
                        "is_verified": True,
                        "university": log.uploaded_by.university,
                    },
                )
                if created:
                    user.set_unusable_password()
                    user.save()

                # Parse bus_pass_validity
                validity = None
                validity_val = str(row.get("bus_pass_validity", "")).strip()
                if validity_val and validity_val.lower() not in ("none", "nan", ""):
                    from datetime import datetime as dt
                    for fmt in ("%Y-%m-%d", "%d/%m/%Y", "%m/%d/%Y"):
                        try:
                            validity = dt.strptime(validity_val, fmt).date()
                            break
                        except ValueError:
                            continue

                StudentProfile.objects.update_or_create(
                    user=user,
                    defaults={
                        "student_name": str(row.get("student_name", "")).strip(),
                        "student_id": str(row.get("student_id", "")).strip(),
                        "bus_pass_id": str(row.get("bus_pass_id", "")).strip() or None,
                        "bus_pass_validity": validity,
                        "phone_number": str(row.get("phone_number", "")).strip(),
                    },
                )

                v_num = str(row.get("vehicle_number", "")).strip()
                if v_num:
                    vehicle = Vehicle.objects.filter(
                        university=log.uploaded_by.university,
                        vehicle_number__iexact=v_num,
                    ).first()
                    if vehicle:
                        StudentAssignment.objects.update_or_create(
                            student=user, defaults={"vehicle": vehicle}
                        )
                    else:
                        errors.append({
                            "row": idx,
                            "reason": f"Vehicle '{v_num}' not found. User created but unassigned.",
                        })

                success_count += 1

            except Exception as e:
                errors.append({"row": idx, "reason": str(e)})

        log.success_count = success_count
        log.error_count = len(errors)
        log.errors = errors
        log.save()

    except Exception as e:
        log.errors = [{"row": 0, "reason": f"File processing error: {e}"}]
        log.error_count = 1
        log.save()
        return {"status": "error", "reason": str(e)}
    finally:
        if os.path.exists(file_path):
            os.remove(file_path)

    print(f"[BulkUpload] Log {log_id}: {success_count} OK, {len(errors)} errors")
    return {"status": "done", "success": success_count, "errors": len(errors)}
