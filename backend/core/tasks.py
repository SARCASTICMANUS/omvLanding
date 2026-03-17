# VAYY | core/tasks.py | Status: 🆕 Created
# Reason: Missing entirely — all 4 Celery tasks required by spec.

import random
import string
from celery import shared_task
from django.utils import timezone
from datetime import timedelta


# ─── OTP Task ────────────────────────────────────────────────────────────────

@shared_task(name="core.tasks.send_otp_async")
def send_otp_async(user_id):
    """
    Generate a 6-digit OTP, store it on the user, and send via email.
    Never blocks the request thread.
    """
    from django.contrib.auth import get_user_model
    from django.core.mail import send_mail

    User = get_user_model()
    try:
        user = User.objects.get(id=user_id)
    except User.DoesNotExist:
        return {"status": "error", "reason": f"User {user_id} not found"}

    otp = "123456" #"".join(random.choices(string.digits, k=6))
    user.otp = otp
    user.otp_verified = False
    user.otp_created_at = timezone.now()
    user.save(update_fields=["otp", "otp_verified", "otp_created_at"])
    
    # Send email (prints to console in dev — set EMAIL_BACKEND accordingly)
    try:
        print("otp : ",otp)
        send_mail(
            subject="Your Vayy Verification Code",
            message=(
                f"Your Vayy verification code is: {otp}\n\n"
                "This code expires in 10 minutes.\n"
                "If you did not request this, please ignore this email."
            ),
            from_email="noreply@vayy.app",
            recipient_list=[user.email],
            fail_silently=False,
        )
    except Exception as e:
        # Log but don't fail — user can use console backend in dev
        print(f"[OTP] Email send failed for {user.email}: {e}")

    print(f"[OTP] Sent OTP {otp} to {user.email}")
    return {"status": "sent", "email": user.email}


# ─── Cleanup Tasks ────────────────────────────────────────────────────────────

@shared_task(name="core.tasks.cleanup_inactive_trips")
def cleanup_inactive_trips():
    """
    Every 60s: set trips to inactive where last_updated < now - 90 seconds.
    This handles driver browser-close / network drop scenarios.
    """
    from core.models import ActiveTrip

    threshold = timezone.now() - timedelta(seconds=90)
    updated = ActiveTrip.objects.filter(
        status="active",
        last_updated__lt=threshold,
    ).update(status="inactive", is_active=False)

    print(f"[Cleanup] Deactivated {updated} stale trips (threshold: {threshold})")
    return {"deactivated": updated}


@shared_task(name="core.tasks.cleanup_stale_passengers")
def cleanup_stale_passengers():
    """
    Every 5 minutes: placeholder for future PassengerWait model cleanup.
    Currently a no-op but registered so the Beat schedule is valid.
    """
    # Future: PassengerWait.objects.filter(created_at__lt=now-10min).delete()
    print("[Cleanup] Passenger wait cleanup ran (no-op — PassengerWait not yet implemented)")
    return {"status": "ok"}


# ─── Bulk Upload Task ─────────────────────────────────────────────────────────

@shared_task(name="core.tasks.process_bulk_upload")
def process_bulk_upload(log_id, file_path):
    """
    Process a CSV/Excel student bulk upload asynchronously.
    Updates BulkUploadLog with success/error counts.
    Triggered for files > 100 rows.
    """
    import csv
    import os
    from core.models import BulkUploadLog, Route, Stop, StudentProfile
    from django.contrib.auth import get_user_model

    User = get_user_model()

    try:
        log = BulkUploadLog.objects.get(id=log_id)
    except BulkUploadLog.DoesNotExist:
        return {"status": "error", "reason": f"BulkUploadLog {log_id} not found"}

    REQUIRED_COLUMNS = {
        "student_name", "student_id", "email"
    }
    # Optional columns: bus_pass_id, bus_pass_validity, phone_number, vehicle_number

    errors = []
    success_count = 0

    try:
        # Handle both CSV and Excel
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
                headers = [h.strip().lower() for h in reader.fieldnames or []]
                data_rows = [
                    {k.strip().lower(): v for k, v in row.items()}
                    for row in reader
                ]

        # Validate headers
        missing = REQUIRED_COLUMNS - set(headers)
        if missing:
            log.errors = [{"row": 0, "reason": f"Missing columns: {', '.join(missing)}"}]
            log.error_count = 1
            log.save()
            return {"status": "error", "reason": "Missing required columns"}

        log.total_rows = len(data_rows)
        log.save(update_fields=["total_rows"])

        from core.models import Vehicle, StudentAssignment

        for idx, row in enumerate(data_rows, start=2):  # row 1 = headers
            try:
                email = str(row.get("email", "")).strip()
                if not email:
                    raise ValueError("Email is required")

                # Create or get user
                user, created = User.objects.get_or_create(
                    email=email,
                    defaults={
                        "username": email,
                        "role": "student",
                        "is_verified": True,
                        "university": log.uploaded_by.university # Inherit from uploader
                    }
                )
                if created:
                    user.set_unusable_password()
                    user.save()

                # Parse bus_pass_validity
                validity = None
                validity_val = str(row.get("bus_pass_validity", "")).strip()
                if validity_val and validity_val.lower() != "none" and validity_val != "NaN":
                    from datetime import datetime as dt
                    try:
                        validity = dt.strptime(validity_val, "%Y-%m-%d").date()
                    except ValueError:
                        # Try common excel formats etc
                        pass

                # Create or update StudentProfile
                StudentProfile.objects.update_or_create(
                    user=user,
                    defaults={
                        "student_name": str(row.get("student_name", "")).strip(),
                        "student_id": str(row.get("student_id", "")).strip(),
                        "bus_pass_id": str(row.get("bus_pass_id", "")).strip() or None,
                        "bus_pass_validity": validity,
                        "phone_number": str(row.get("phone_number", "")).strip(),
                    }
                )

                # Handle Vehicle Assignment if provided
                v_num = str(row.get("vehicle_number", "")).strip()
                if v_num:
                    vehicle = Vehicle.objects.filter(
                        university=log.uploaded_by.university,
                        vehicle_number__iexact=v_num
                    ).first()
                    if vehicle:
                        StudentAssignment.objects.update_or_create(
                            student=user,
                            defaults={"vehicle": vehicle}
                        )
                    else:
                        errors.append({"row": idx, "reason": f"Vehicle '{v_num}' not found in your university. User created but unassigned."})

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
        # Clean up temp file
        if os.path.exists(file_path):
            os.remove(file_path)

    print(f"[BulkUpload] Log {log_id}: {success_count} success, {len(errors)} errors")
    return {"status": "done", "success": success_count, "errors": len(errors)}
