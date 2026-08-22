from django.contrib.auth import authenticate
from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError
from rest_framework.exceptions import AuthenticationFailed

from rest_framework_simplejwt.tokens import RefreshToken

from accounts.models import User
from accounts.services.otp_service import OTPService
from communication.tasks import send_otp_task, send_password_reset_otp_task


class AuthService:
    """
    Authentication business logic.
    """

    # JWT
    @staticmethod
    def generate_tokens(user: User) -> dict:
        refresh = RefreshToken.for_user(user)

        return {
            "refresh": str(refresh),
            "access": str(refresh.access_token),
        }

    # REGISTER
    @classmethod
    def register_user(
        cls,
        *,
        email: str,
        password: str,
        role: str,
        first_name: str = "",
        last_name: str = "",
        city=None,
    ) -> User:
        """
        Create new user.
        """

        if User.objects.filter(email=email).exists():
            raise ValidationError(
                "User with this email already exists."
            )

        validate_password(password)

        user = User.objects.create_user(
            email=email,
            password=password,
            role=role,
            first_name=first_name,
            last_name=last_name,
            city=city,
        )

        otp = OTPService.create_otp(user)

        send_otp_task.delay(user.id, otp)

        return user

    # LOGIN
    @classmethod
    def login_user(
        cls,
        *,
        email: str,
        password: str,
    ) -> dict:
        """
        Authenticate and return JWT tokens.
        """

        user = authenticate(
            username=email,
            password=password,
        )

        if not user:
            raise AuthenticationFailed(
                "Invalid email or password."
            )

        tokens = cls.generate_tokens(user)

        return {
            "user": user,
            "tokens": tokens,
        }

    # VERIFY ACCOUNT
    @classmethod
    def verify_account(
        cls,
        *,
        email: str,
        otp: str,
    ) -> User:
        """
        Verify email using OTP.
        """

        try:
            user = User.objects.get(email=email)

        except User.DoesNotExist:
            raise ValidationError(
                "User not found."
            )

        success = OTPService.verify_otp(
            user=user,
            otp=otp,
        )

        if not success:
            raise ValidationError(
                "Invalid or expired OTP."
            )

        OTPService.clear_otp(user)

        return user

    # RESEND OTP
    @classmethod
    def resend_otp(
        cls,
        *,
        email: str,
    ) -> bool:
        try:
            user = User.objects.get(email=email)

        except User.DoesNotExist:
            raise ValidationError(
                "User not found."
            )

        otp = OTPService.resend_otp(user)

        send_otp_task.delay(user.id, otp)

        return True

    # FORGOT PASSWORD
    @classmethod
    def forgot_password(
        cls,
        *,
        email: str,
    ) -> bool:
        try:
            user = User.objects.get(email=email)

        except User.DoesNotExist:
            raise ValidationError(
                "User not found."
            )

        otp = OTPService.create_password_reset_otp(
            user=user,
        )

        send_password_reset_otp_task.delay(
            user.id,
            otp,
        )

        return True

    # RESET PASSWORD
    @classmethod
    def reset_password(
        cls,
        *,
        email: str,
        otp: str,
        password: str,
    ) -> bool:
        try:
            user = User.objects.get(email=email)

        except User.DoesNotExist:
            raise ValidationError(
                "User not found."
            )

        success = OTPService.verify_otp(
            user=user,
            otp=otp,
        )

        if not success:
            raise ValidationError(
                "Invalid or expired OTP."
            )

        validate_password(password)

        user.set_password(password)
        user.save(update_fields=["password"])

        OTPService.clear_otp(user)

        return True

    # CHANGE PASSWORD
    @classmethod
    def change_password(
        cls,
        *,
        user: User,
        old_password: str,
        new_password: str,
    ) -> bool:
        if not user.check_password(old_password):
            raise ValidationError(
                "Old password is incorrect."
            )

        validate_password(new_password)
        user.set_password(new_password)
        user.save(
            update_fields=[
                "password",
            ]
        )

        return True

    # REFRESH USER
    @staticmethod
    def get_user_profile(
        user: User,
    ) -> User:
        return user