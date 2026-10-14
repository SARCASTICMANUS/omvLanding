import logging
from django.db import transaction
from django.utils import timezone

from accounts.models import User, DriverDocument, PublicDriverProfile
from common.constants import (
    DOC_STATUS_VERIFIED, DOC_STATUS_REJECTED,
    DOC_TYPE_LICENSE, DOC_TYPE_RC,
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

        # Recalculate KYC state so a rejected required document cannot leave the
        # driver marked as verified.
        VerificationService.check_and_verify_profile(doc.driver)

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
        """Persist verified status only after all nine required upload slots pass review."""
        required_slots = {
            "dlFront": DOC_TYPE_LICENSE, "dlBack": DOC_TYPE_LICENSE,
            "rcFront": DOC_TYPE_RC, "rcBack": DOC_TYPE_RC,
            "insuranceFront": "INSURANCE", "insuranceBack": "INSURANCE",
            "aadhaarFront": "IDENTITY", "aadhaarBack": "IDENTITY", "selfie": "IDENTITY",
        }
        fallback_slots = {
            DOC_TYPE_LICENSE: ["dlFront", "dlBack"], DOC_TYPE_RC: ["rcFront", "rcBack"],
            "INSURANCE": ["insuranceFront", "insuranceBack"],
            "IDENTITY": ["aadhaarFront", "aadhaarBack", "selfie"],
        }
        documents = list(DriverDocument.objects.filter(driver=user).order_by("created_at"))
        slot_docs = {key: [] for key in required_slots}
        unkeyed = []
        for doc in documents:
            if doc.doc_key in slot_docs and doc.document_type == required_slots[doc.doc_key]:
                slot_docs[doc.doc_key].append(doc)
            elif doc.document_type in fallback_slots:
                unkeyed.append(doc)
        for doc in unkeyed:
            for key in fallback_slots.get(doc.document_type, []):
                if not slot_docs[key]:
                    slot_docs[key].append(doc)
                    break
        should_be_verified = all(
            slot_docs[key] and all(doc.status == DOC_STATUS_VERIFIED for doc in slot_docs[key])
            for key in required_slots
        )
        try:
            profile = user.driver_profile
        except PublicDriverProfile.DoesNotExist:
            logger.warning("Driver %s has no profile; cannot persist KYC status", user.id)
            return should_be_verified
        was_verified = profile.is_verified
        if was_verified != should_be_verified:
            profile.is_verified = should_be_verified
            profile.save(update_fields=["is_verified"])
        if should_be_verified and not was_verified:
            NotificationService.create(
                user=user, title="Account Verified",
                message="Congratulations! Your driver account has been verified. You can now start receiving trips.",
                metadata={"event": "driver_verified"},
            )
            logger.info("Driver profile for user %s has been automatically verified.", user.id)
        return should_be_verified
