import logging
from django.db import transaction
from django.utils import timezone

from accounts.models import User, DriverDocument, PublicDriverProfile
from common.constants import (
    DOC_STATUS_VERIFIED, DOC_STATUS_REJECTED
)
from communication.services.notification_service import NotificationService

logger = logging.getLogger(__name__)


class VerificationService:
    """
    Handles administrative verification of driver documents and profiles.
    """

    @staticmethod
    @transaction.atomic
    def verify_document(document_id: str, admin_user: User) -> DriverDocument:
        """
        Approves a driver document.
        """
        doc = DriverDocument.objects.select_for_update().get(id=document_id)
        doc.status = DOC_STATUS_VERIFIED
        doc.verified_by = admin_user
        doc.verified_at = timezone.now()
        doc.save()

        logger.info(f"Document {document_id} verified by admin {admin_user.id}")
        
        # Check if all required docs are verified to auto-verify profile
        VerificationService.check_and_verify_profile(doc.driver)
        
        return doc

    @staticmethod
    @transaction.atomic
    def reject_document(document_id: str, reason: str, admin_user: User) -> DriverDocument:
        """
        Rejects a driver document.
        """
        doc = DriverDocument.objects.select_for_update().get(id=document_id)
        doc.status = DOC_STATUS_REJECTED
        doc.rejection_reason = reason
        doc.verified_by = admin_user
        doc.verified_at = timezone.now()
        doc.save()

        # Unverify profile if it was verified
        profile = doc.driver.driver_profile
        if profile.is_verified:
            profile.is_verified = False
            profile.save()

        NotificationService.create(
            user=doc.driver,
            title="Document Rejected",
            message=f"Your {doc.get_document_type_display()} was rejected. Reason: {reason}",
            metadata={"document_id": str(doc.id), "type": doc.document_type}
        )

        logger.warning(f"Document {document_id} rejected by admin {admin_user.id}. Reason: {reason}")
        return doc

    @staticmethod
    def check_and_verify_profile(user: User):
        """
        Verifies the driver profile if all required documents are verified.
        Required: LICENSE, RC
        """
        required_types = ["LICENSE", "RC"]
        verified_count = DriverDocument.objects.filter(
            driver=user,
            document_type__in=required_types,
            status=DOC_STATUS_VERIFIED
        ).count()

        if verified_count >= len(required_types):
            profile = user.driver_profile
            if not profile.is_verified:
                profile.is_verified = True
                profile.save()
                
                NotificationService.create(
                    user=user,
                    title="Account Verified",
                    message="Congratulations! Your driver account has been verified. You can now start receiving trips.",
                    metadata={"event": "driver_verified"}
                )
                logger.info(f"Driver profile for user {user.id} has been automatically verified.")
