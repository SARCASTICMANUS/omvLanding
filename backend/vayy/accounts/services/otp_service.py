import random
from datetime import timedelta

from django.utils import timezone

from accounts.models import User


class OTPService:
    OTP_LENGTH = 6
    OTP_EXPIRY_MINUTES = 10

    @classmethod
    def generate_otp(cls) -> str:
        """
        Generate numeric OTP.

        Example:
        483921
        """
        return "".join(
            str(random.randint(0, 9))
            for _ in range(cls.OTP_LENGTH)
        )

    @classmethod
    def create_otp(cls, user: User) -> str:
        """
        Create and store OTP.
        """
        otp = cls.generate_otp()

        user.otp = otp
        user.otp_verified = False
        user.otp_created_at = timezone.now()

        user.save(
            update_fields=[
                "otp",
                "otp_verified",
                "otp_created_at",
            ]
        )

        return otp

    @classmethod
    def is_expired(cls, user: User) -> bool:
        """
        Check if OTP is expired.
        """
        if not user.otp_created_at:
            return True

        expiry_time = (
            user.otp_created_at
            + timedelta(minutes=cls.OTP_EXPIRY_MINUTES)
        )

        return timezone.now() > expiry_time

    @classmethod
    def verify_otp(
        cls,
        user: User,
        otp: str,
    ) -> bool:
        """
        Verify OTP.
        """

        if not user.otp:
            return False

        if cls.is_expired(user):
            return False

        if user.otp != otp:
            return False

        user.otp_verified = True
        user.is_verified = True

        user.save(
            update_fields=[
                "otp_verified",
                "is_verified",
            ]
        )

        return True

    @classmethod
    def clear_otp(cls, user: User):
        """
        Remove OTP after successful verification.
        """

        user.otp = None
        user.otp_created_at = None

        user.save(
            update_fields=[
                "otp",
                "otp_created_at",
            ]
        )

    @classmethod
    def resend_otp(cls, user: User) -> str:
        """
        Generate fresh OTP.
        """
        return cls.create_otp(user)

    @classmethod
    def create_password_reset_otp(
        cls,
        user: User,
    ) -> str:
        """
        Password reset OTP.
        """
        return cls.create_otp(user)