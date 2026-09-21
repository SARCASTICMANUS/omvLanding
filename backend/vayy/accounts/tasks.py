import logging

from celery import shared_task

logger = logging.getLogger(__name__)


@shared_task(
    bind=True,
    max_retries=2,
    queue="celery",
    acks_late=True,
    reject_on_worker_lost=True,
)
def process_driver_registration(self, job_id, user_id):
    from accounts.services.registration_service import RegistrationService
    from accounts.models import PublicDriverProfile, DriverDocument, DriverBankDetail, Wallet
    from operations.models import Vehicle
    from communication.services.notification_service import NotificationService
    from common.constants import (
        VEHICLE_STATUS_PENDING,
        ROLE_BIKE_DRIVER,
        ROLE_AUTO_DRIVER,
    )

    try:
        data = RegistrationService.get_payload(job_id)
        if not data:
            logger.warning("[Registration] Payload expired for job %s", job_id)
            return

        from django.contrib.auth import get_user_model

        User = get_user_model()
        user = User.objects.get(id=user_id)
        payload = data["payload"]

        # 1. Update role
        role = payload.get("role", "")
        if role in (ROLE_BIKE_DRIVER, ROLE_AUTO_DRIVER):
            user.role = role
            user.save(update_fields=["role"])

        # 2. Profile
        profile, _ = PublicDriverProfile.objects.get_or_create(user=user)
        profile.display_name = payload.get("display_name", "") or user.first_name
        profile.phone_number = payload.get("phone_number", "")
        profile.vehicle_number = payload["vehicle_number"]
        profile.vehicle_type = payload["vehicle_type"]
        profile.dob = payload.get("dob")
        profile.gender = payload.get("gender", "")
        profile.rc_number = payload.get("rc_number", "")
        profile.save()

        # 3. Vehicle
        Vehicle.objects.update_or_create(
            driver=user,
            vehicle_number=payload["vehicle_number"],
            defaults={
                "vehicle_type": payload["vehicle_type"],
                "vehicle_photo": payload.get("vehicle_photo", ""),
                "status": VEHICLE_STATUS_PENDING,
                "is_active": False,
            },
        )

        # 4. Documents — bulk_create
        DriverDocument.objects.filter(driver=user).delete()
        docs_to_create = []
        for doc_input in payload.get("documents", []):
            file_base64 = doc_input.get("file_base64", "")
            if file_base64:
                docs_to_create.append(
                    DriverDocument(
                        driver=user,
                        document_type=doc_input["document_type"],
                        file_data=file_base64,
                        file_name=doc_input.get("file_name", "upload.jpg"),
                    )
                )
        if docs_to_create:
            DriverDocument.objects.bulk_create(docs_to_create)

        # 5. Bank details
        bank = payload.get("bank_details", {})
        if bank and any(bank.get(f) for f in ["holder_name", "account_number", "ifsc", "upi"]):
            detail, _ = DriverBankDetail.objects.get_or_create(driver=user)
            for f in ["holder_name", "account_number", "ifsc", "upi"]:
                if f in bank:
                    setattr(detail, f, bank[f])
            detail.save()

        # 6. Wallet
        Wallet.objects.get_or_create(
            user=user, defaults={"balance": 0, "currency": "INR"}
        )

        # 7. Notify success
        NotificationService.create(
            user=user,
            title="Registration Complete",
            message="Your driver account has been set up. You will be verified shortly.",
            notification_type="push",
            metadata={"event": "registration_complete"},
        )

        RegistrationService.cleanup(job_id)
        logger.info("[Registration] Completed for user %s", user_id)

    except Exception as exc:
        logger.error(
            "[Registration] Failed for user %s: %s", user_id, exc, exc_info=True
        )
        try:
            from django.contrib.auth import get_user_model

            User = get_user_model()
            user = User.objects.get(id=user_id)
            NotificationService.create(
                user=user,
                title="Registration Failed",
                message="Something went wrong during registration. Please try again.",
                notification_type="push",
                metadata={"event": "registration_failed"},
            )
        except Exception:
            pass
        RegistrationService.cleanup(job_id)
        raise self.retry(exc=exc)
