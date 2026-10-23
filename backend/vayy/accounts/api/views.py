import os
import json
import logging
import hmac
import hashlib
from decimal import Decimal, InvalidOperation
from django.utils import timezone
from django.conf import settings
from django.core.cache import cache
from django.db import transaction
from django.db.utils import IntegrityError
from rest_framework import status, viewsets, serializers
from rest_framework.views import APIView
from rest_framework.permissions import (
    IsAuthenticated,
    AllowAny,
)
from rest_framework.response import Response
from rest_framework.decorators import action

from accounts.models import (
    User,
    PublicPassengerProfile,
    PublicDriverProfile,
    Wallet,
    Transaction,
    PaymentMethod,
    PaymentOrder,
    DriverDocument,
    RecentSearch,
    DriverBankDetail,
)

from common.constants import (
    DOC_STATUS_PENDING,
    DOC_STATUS_VERIFIED,
    DOC_STATUS_REJECTED,
    DOC_TYPE_LICENSE,
    DOC_TYPE_RC,
    ROLE_ADMIN,
    ROLE_PASSENGER,
    ROLE_BIKE_DRIVER,
    ROLE_AUTO_DRIVER,
)

from accounts.api.serializers import (
    UserSerializer,
    UserCreateUpdateSerializer,
    CurrentUserUpdateSerializer,
    RegisterSerializer,
    LoginSerializer,
    OTPSerializer,
    ResendOTPSerializer,
    ForgotPasswordSerializer,
    ResetPasswordSerializer,
    ChangePasswordSerializer,
    PassengerProfileSerializer,
    DriverProfileSerializer,
    MergedPassengerProfileSerializer,
    MergedPassengerProfileUpdateSerializer,
    MergedDriverProfileSerializer,
    MergedDriverProfileUpdateSerializer,
    WalletSerializer,
    TransactionSerializer,
    DriverDocumentSerializer,
    DriverDocumentListSerializer,
    RecentSearchSerializer,
    RecentSearchCreateSerializer,
    DriverBankDetailSerializer,
    DriverBankDetailUpdateSerializer,
    CompleteDriverRegistrationSerializer,
)

from accounts.services.auth_service import AuthService
from accounts.services.wallet_service import WalletService
from accounts.services.otp_service import OTPService
from accounts.permissions import (
    IsAdmin,
    IsDriver,
    IsDriverOrAdmin,
    IsPassenger,
    IsPassengerOrAdmin,
)
from common.responses import success_response, error_response

logger = logging.getLogger(__name__)

# Redis TTL for registration OTP payload (10 minutes)
_REG_OTP_TTL = 600

# REGISTER
class RegisterAPIView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        serializer = RegisterSerializer(
            data=request.data
        )
        serializer.is_valid(
            raise_exception=True
        )
        user = AuthService.register_user(
            email=serializer.validated_data["email"],
            password=serializer.validated_data["password"],
            role=serializer.validated_data["role"],
            first_name=serializer.validated_data.get(
                "first_name", ""
            ),
            last_name=serializer.validated_data.get(
                "last_name", ""
            ),
        )

        resp = success_response(
            data=UserSerializer(user).data,
            message="Registration successful. Safety Code sent.",
            status_code=status.HTTP_201_CREATED
        )
        return resp


# SEND REGISTRATION OTP (driver only — stores data in Redis, sends OTP, does NOT create user)
class SendRegistrationOTPAPIView(APIView):
    """
    POST /api/accounts/send-registration-otp/
    Accepts email, password, role, first_name.
    Stores registration data in Redis with OTP, sends OTP email.
    Does NOT create the User — that happens after OTP verification.
    """
    permission_classes = [AllowAny]

    def post(self, request):
        from django.contrib.auth.password_validation import validate_password
        from django.core.exceptions import ValidationError as DjangoValidationError

        email = request.data.get("email", "").strip().lower()
        password = request.data.get("password", "")
        role = request.data.get("role", "")
        first_name = request.data.get("first_name", "")

        if not email:
            return Response(
                {"success": False, "message": "Email is required"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if not password or len(password) < 8:
            return Response(
                {"success": False, "message": "Password must be at least 8 characters"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if role not in ("bikedriver", "autodriver"):
            return Response(
                {"success": False, "message": "Role must be bikedriver or autodriver"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if User.objects.filter(email=email).exists():
            return Response(
                {"success": False, "message": "An account with this email already exists"},
                status=status.HTTP_409_CONFLICT,
            )

        try:
            validate_password(password)
        except DjangoValidationError as e:
            return Response(
                {"success": False, "message": "; ".join(e.messages)},
                status=status.HTTP_400_BAD_REQUEST,
            )

        otp = OTPService.generate_otp()

        reg_data = {
            "email": email,
            "password": password,
            "role": role,
            "first_name": first_name,
            "otp": otp,
        }
        cache.set(f"reg_otp:driver:{email}", reg_data, _REG_OTP_TTL)

        from communication.tasks import send_registration_otp_task
        send_registration_otp_task.delay(email, otp)

        return success_response(
            message="Safety Code sent to your email",
            status_code=status.HTTP_200_OK,
        )


# VERIFY OTP AND REGISTER (driver only — verifies OTP from Redis, then creates user)
class VerifyAndRegisterAPIView(APIView):
    """
    POST /api/accounts/verify-and-register/
    Accepts email + OTP. Verifies against Redis-stored data.
    If valid, creates the User and returns user data.
    """
    permission_classes = [AllowAny]

    def post(self, request):
        email = request.data.get("email", "").strip().lower()
        otp = request.data.get("otp", "")

        if not email or not otp:
            return Response(
                {"success": False, "message": "Email and OTP are required"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        reg_data = cache.get(f"reg_otp:driver:{email}")

        if not reg_data:
            return Response(
                {"success": False, "message": "OTP expired or not found. Please request a new one."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if reg_data.get("otp") != otp:
            return Response(
                {"success": False, "message": "Invalid Safety Code"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            user = User.objects.create_user(
                email=reg_data["email"],
                password=reg_data["password"],
                role=reg_data["role"],
                first_name=reg_data.get("first_name", ""),
            )
            user.otp_verified = True
            user.is_verified = True
            user.save(update_fields=["otp_verified", "is_verified"])
        except Exception as e:
            logger.error("Failed to create user during registration: %s", e)
            return Response(
                {"success": False, "message": "Failed to create account"},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )

        cache.delete(f"reg_otp:driver:{email}")

        return success_response(
            data=UserSerializer(user).data,
            message="Account created successfully",
            status_code=status.HTTP_201_CREATED,
        )


# RESEND REGISTRATION OTP (driver only — regenerates OTP stored in Redis)
class ResendRegistrationOTPAPIView(APIView):
    """
    POST /api/accounts/resend-registration-otp/
    Accepts email. Reads existing registration data from Redis,
    generates a new OTP, sends it via email.
    """
    permission_classes = [AllowAny]

    def post(self, request):
        email = request.data.get("email", "").strip().lower()

        if not email:
            return Response(
                {"success": False, "message": "Email is required"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        reg_data = cache.get(f"reg_otp:driver:{email}")

        if not reg_data:
            return Response(
                {"success": False, "message": "OTP expired or not found. Please request a new one."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        otp = OTPService.generate_otp()
        reg_data["otp"] = otp
        cache.set(f"reg_otp:driver:{email}", reg_data, _REG_OTP_TTL)

        from communication.tasks import send_registration_otp_task
        send_registration_otp_task.delay(email, otp)

        return success_response(
            message="Safety Code resent to your email",
            status_code=status.HTTP_200_OK,
        )


# COMPLETE DRIVER REGISTRATION (after OTP verify + login)
class CompleteDriverRegistrationAPIView(APIView):
    """
    POST /api/accounts/complete-registration/
    Authenticated user submits vehicle + documents + bank details.
    Heavy work is dispatched to Celery; returns 202 immediately.
    """

    permission_classes = [IsAuthenticated, IsDriver]

    def post(self, request):
        serializer = CompleteDriverRegistrationSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        from uuid import uuid4
        from accounts.services.registration_service import RegistrationService
        from accounts.tasks import process_driver_registration

        job_id = str(uuid4())
        RegistrationService.save_payload(
            job_id, request.user.id, serializer.validated_data
        )

        process_driver_registration.delay(job_id, request.user.id)

        return Response(
            {
                "success": True,
                "message": "Registration submitted",
                "data": {"job_id": job_id},
            },
            status=status.HTTP_202_ACCEPTED,
        )

# LOGIN
class LoginAPIView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        serializer = LoginSerializer(
            data=request.data
        )

        serializer.is_valid(
            raise_exception=True
        )

        result = AuthService.login_user(
            email=serializer.validated_data["email"],
            password=serializer.validated_data["password"],
        )

        resp = success_response(
            data={
                "user": UserSerializer(result["user"]).data,
                "tokens": result["tokens"]
            },
            message="Login successful"
        )
        return resp

# VERIFY OTP
class VerifyOTPAPIView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        serializer = OTPSerializer(
            data=request.data
        )
        serializer.is_valid(
            raise_exception=True
        )
        user = AuthService.verify_account(
            email=serializer.validated_data["email"],
            otp=serializer.validated_data["otp"],
        )
        resp = success_response(
            data=UserSerializer(user).data,
            message="Account verified successfully."
        )
        return resp

# RESEND OTP
class ResendOTPAPIView(APIView):
    permission_classes = [AllowAny]
    def post(self, request):
        serializer = ResendOTPSerializer(
            data=request.data
        )
        serializer.is_valid(
            raise_exception=True
        )
        AuthService.resend_otp(
            email=serializer.validated_data["email"]
        )
        resp = success_response(
            message="Safety Code resent successfully."
        )
        return resp

# FORGOT PASSWORD
class ForgotPasswordAPIView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        serializer = ForgotPasswordSerializer(
            data=request.data
        )
        serializer.is_valid(
            raise_exception=True
        )
        AuthService.forgot_password(
            email=serializer.validated_data["email"]
        )
        resp = success_response(
            message="Password reset Safety Code sent."
        )
        return resp

# RESET PASSWORD
class ResetPasswordAPIView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        serializer = ResetPasswordSerializer(
            data=request.data
        )
        serializer.is_valid(
            raise_exception=True
        )
        AuthService.reset_password(
            email=serializer.validated_data["email"],
            otp=serializer.validated_data["otp"],
            password=serializer.validated_data["password"],
        )
        resp = success_response(
            message="Password reset successful."
        )
        return resp

# CHANGE PASSWORD
class ChangePasswordAPIView(APIView):
    permission_classes = [
        IsAuthenticated
    ]
    def post(self, request):
        serializer = ChangePasswordSerializer(
            data=request.data
        )
        serializer.is_valid(
            raise_exception=True
        )
        AuthService.change_password(
            user=request.user,
            old_password=serializer.validated_data[
                "old_password"
            ],
            new_password=serializer.validated_data[
                "new_password"
            ],
        )
        resp = success_response(
            message="Password changed successfully."
        )
        return resp

def _driver_verification_payload(user):
    from accounts.services.verification_service import VerificationService

    """Canonical KYC state; OTP/account verification is separate from document verification."""
    is_driver = user.role in (ROLE_BIKE_DRIVER, ROLE_AUTO_DRIVER)
    docs = DriverDocument.objects.filter(driver=user).order_by("created_at") if is_driver else DriverDocument.objects.none()
    doc_list = DriverDocumentListSerializer(docs, many=True).data
    if not is_driver:
        verified = bool(user.is_verified)
        return {"is_verified": verified, "status": "verified" if verified else "unverified",
                "stage": "fully_verified" if verified else "docs_pending", "can_use_app": True,
                "title": "Verified" if verified else "Account status", "message": "" if verified else "Your account is not yet verified.",
                "required_docs": [], "uploaded_docs": [], "missing_docs": [], "rejection_reason": "", "submitted_at": None, "documents": []}
    required = (
        ("dlFront", DOC_TYPE_LICENSE, "Driving License (front)"),
        ("dlBack", DOC_TYPE_LICENSE, "Driving License (back)"),
        ("rcFront", DOC_TYPE_RC, "Registration Certificate (front)"),
        ("rcBack", DOC_TYPE_RC, "Registration Certificate (back)"),
        ("insuranceFront", "INSURANCE", "Vehicle Insurance (front)"),
        ("insuranceBack", "INSURANCE", "Vehicle Insurance (back)"),
        ("aadhaarFront", "IDENTITY", "Identity Proof (front)"),
        ("aadhaarBack", "IDENTITY", "Identity Proof (back)"),
        ("selfie", "IDENTITY", "Selfie Verification"),
    )
    slot_docs = {key: [] for key, _, _ in required}
    legacy_slots = {
        DOC_TYPE_LICENSE: ["dlFront", "dlBack"], DOC_TYPE_RC: ["rcFront", "rcBack"],
        "INSURANCE": ["insuranceFront", "insuranceBack"],
        "IDENTITY": ["aadhaarFront", "aadhaarBack", "selfie"],
    }
    relevant = [doc for doc in doc_list if doc.get("document_type") in legacy_slots]
    unkeyed = []
    slot_types = {key: kind for key, kind, _ in required}
    for doc in relevant:
        key = doc.get("doc_key")
        if key in slot_docs and doc.get("document_type") == slot_types[key]:
            slot_docs[key].append(doc)
        else:
            unkeyed.append(doc)
    # Backward compatibility for documents uploaded before doc_key was introduced.
    for doc in unkeyed:
        for key in legacy_slots.get(doc.get("document_type"), []):
            if not slot_docs[key]:
                slot_docs[key].append(doc)
                break
    missing = [label for key, _, label in required if not slot_docs[key]]
    rejected = [doc for docs_for_slot in slot_docs.values() for doc in docs_for_slot
                if doc.get("status") == DOC_STATUS_REJECTED]
    all_approved = all(
        slot_docs[key] and all(doc.get("status") == DOC_STATUS_VERIFIED for doc in slot_docs[key])
        for key, _, _ in required
    )
    vehicle_verified = VerificationService.has_approved_vehicle(user)
    if not user.otp_verified:
        stage = "email_pending"
        status_value = "not_submitted" if not relevant else "pending"
        message = "Verify your email before completing driver verification."
    elif rejected:
        stage, status_value, message = "docs_rejected", "rejected", "One or more required documents were rejected. Please replace the rejected documents."
    elif not vehicle_verified:
        stage, status_value = "docs_pending", "not_submitted" if not relevant else "pending"
        message = "Add your vehicle number, registration, and vehicle documents before verification can be completed."
    elif all_approved:
        stage, status_value, message = "fully_verified", "verified", "All required driver documents have been verified."
    elif missing:
        stage, status_value = "docs_pending", "not_submitted" if not relevant else "pending"
        message = "Upload all required documents to complete verification."
    else:
        stage, status_value, message = "docs_under_review", "pending", "Your documents are under review."
    dates = [doc.get("created_at") for doc in relevant if doc.get("created_at")]
    rejection_reason = next((doc.get("rejection_reason") or "" for doc in rejected if doc.get("rejection_reason")), "")
    titles = {"email_pending": "Email verification required", "docs_pending": "Complete your verification",
              "docs_under_review": "Documents under review", "docs_rejected": "Documents rejected", "fully_verified": "Driver verified"}
    return {"is_verified": stage == "fully_verified", "status": status_value, "stage": stage,
            "can_use_app": stage == "fully_verified", "title": titles[stage], "message": message,
            "required_docs": [label for _, _, label in required],
            "uploaded_docs": [label for key, _, label in required if slot_docs[key]], "missing_docs": missing,
            "rejection_reason": rejection_reason, "submitted_at": min(dates) if dates else None, "documents": doc_list}


# CURRENT USER
class CurrentUserAPIView(APIView):
    permission_classes = [
        IsAuthenticated
    ]

    def get(self, request):
        user_data = UserSerializer(request.user).data
        # Preserve flat user fields while exposing verification for VerificationGate.
        return success_response(data={**user_data, "user": user_data,
                                      "verification": _driver_verification_payload(request.user)})

    def patch(self, request):
        serializer = CurrentUserUpdateSerializer(
            request.user,
            data=request.data,
            partial=True,
        )
        serializer.is_valid(
            raise_exception=True
        )
        serializer.save()

        resp = success_response(
            data=UserSerializer(
                request.user
            ).data
        )
        return resp

    def put(self, request):
        return self.patch(request)

# PASSENGER PROFILE (merged with /me)
class PassengerProfileAPIView(APIView):
    permission_classes = [
        IsAuthenticated,
        IsPassengerOrAdmin,
    ]

    def _get_merged_data(self, user):
        """Build a flat dict with User + Profile fields."""
        profile, _ = PublicPassengerProfile.objects.get_or_create(
            user=user,
            defaults={
                "display_name": user.get_full_name() or user.email.split("@")[0],
            },
        )
        saved_routes = list(profile.saved_routes.all())

        return {
            "user": user,
            "profile": profile,
            "saved_routes_obj": saved_routes,
            "home_location_obj": profile.home_location,
            "current_location_obj": profile.current_location,
            # User fields
            "first_name": user.first_name,
            "last_name": user.last_name,
            "city": user.city,
            "city_name": user.city.name if user.city else None,
            # Profile fields
            "display_name": profile.display_name,
            "phone_number": profile.phone_number,
            "bio": profile.bio,
            "profile_photo": profile.profile_photo,
            "last_active_at": profile.last_active_at,
        }

    def _get_target_user(self, request):
        user_id = request.query_params.get("user_id")
        if user_id and (request.user.role == ROLE_ADMIN or request.user.is_staff):
            from accounts.models import User
            try:
                return User.objects.get(id=user_id)
            except User.DoesNotExist:
                return None
        return request.user

    def get(self, request):
        target = self._get_target_user(request)
        if target is None:
            return error_response(
                message="User not found",
                status_code=status.HTTP_404_NOT_FOUND,
            )
        data = self._get_merged_data(target)
        serializer = MergedPassengerProfileSerializer(data)
        resp = success_response(data=serializer.data)
        return resp

    def put(self, request):
        update_ser = MergedPassengerProfileUpdateSerializer(data=request.data)
        update_ser.is_valid(raise_exception=True)
        attrs = update_ser.validated_data

        # Support admin updating another user's profile via ?user_id
        user = request.user
        user_id = request.query_params.get("user_id")
        if user_id and (request.user.role == ROLE_ADMIN or request.user.is_staff):
            from accounts.models import User
            try:
                user = User.objects.get(id=user_id)
            except User.DoesNotExist:
                return error_response(
                    message="User not found",
                    status_code=status.HTTP_404_NOT_FOUND,
                )

        # Update User fields
        if "first_name" in attrs:
            user.first_name = attrs["first_name"]
        if "last_name" in attrs:
            user.last_name = attrs["last_name"]
        if "city" in attrs:
            user.city_id = attrs["city"]
        user.save(update_fields=["first_name", "last_name", "city"])

        # Update Profile fields
        profile, _ = PublicPassengerProfile.objects.get_or_create(user=user)
        profile_fields = ["display_name", "phone_number", "bio", "profile_photo"]
        for f in profile_fields:
            if f in attrs:
                setattr(profile, f, attrs[f])
        profile.save()

        # Update saved_routes
        if "saved_routes" in attrs:
            from transport.models import Route
            route_ids = attrs["saved_routes"]
            profile.saved_routes.set(
                Route.objects.filter(id__in=route_ids)
            )

        data = self._get_merged_data(user)
        serializer = MergedPassengerProfileSerializer(data)
        resp = success_response(data=serializer.data)
        return resp

# DRIVER PROFILE
class DriverProfileAPIView(APIView):
    permission_classes = [
        IsAuthenticated,
        IsDriverOrAdmin,
    ]

    def _get_merged_data(self, user):
        """Build a flat dict with User + Profile fields."""
        profile, _ = PublicDriverProfile.objects.get_or_create(
            user=user,
            defaults={
                "display_name": user.get_full_name() or user.email.split("@")[0],
            },
        )

        vehicle_photo = ""
        from operations.models import Vehicle
        vehicle = Vehicle.objects.filter(driver=user).first()
        if vehicle:
            vehicle_photo = vehicle.vehicle_photo or ""

        return {
            "user": user,
            "profile": profile,
            "first_name": user.first_name,
            "last_name": user.last_name,
            "city": user.city,
            "city_name": user.city.name if user.city else None,
            "display_name": profile.display_name,
            "phone_number": profile.phone_number,
            "bio": profile.bio,
            "license_number": profile.license_number,
            "vehicle_number": profile.vehicle_number,
            "vehicle_type": profile.vehicle_type,
            "rc_number": profile.rc_number,
            "dob": profile.dob.isoformat() if profile.dob else None,
            "gender": profile.gender,
            "vehicle_photo": vehicle_photo,
            "is_verified": profile.is_verified,
            "rating": profile.rating,
            "total_trips": profile.total_trips,
        }

    def _get_target_user(self, request):
        user_id = request.query_params.get("user_id")
        if user_id and (request.user.role == ROLE_ADMIN or request.user.is_staff):
            from accounts.models import User
            try:
                return User.objects.get(id=user_id)
            except User.DoesNotExist:
                return None
        return request.user

    def get(self, request):
        target = self._get_target_user(request)
        if target is None:
            return error_response(
                message="User not found",
                status_code=status.HTTP_404_NOT_FOUND,
            )
        data = self._get_merged_data(target)
        serializer = MergedDriverProfileSerializer(data)
        resp = success_response(data=serializer.data)
        return resp

    def put(self, request):
        update_ser = MergedDriverProfileUpdateSerializer(data=request.data)
        update_ser.is_valid(raise_exception=True)
        attrs = update_ser.validated_data

        # Support admin updating another user's profile via ?user_id
        user = request.user
        user_id = request.query_params.get("user_id")
        if user_id and (request.user.role == ROLE_ADMIN or request.user.is_staff):
            from accounts.models import User
            try:
                user = User.objects.get(id=user_id)
            except User.DoesNotExist:
                return error_response(
                    message="User not found",
                    status_code=status.HTTP_404_NOT_FOUND,
                )

        # Update User fields
        if "first_name" in attrs:
            user.first_name = attrs["first_name"]
        if "last_name" in attrs:
            user.last_name = attrs["last_name"]
        if "city" in attrs:
            user.city_id = attrs["city"]
        user.save(update_fields=["first_name", "last_name", "city"])

        # Update Profile fields
        profile, _ = PublicDriverProfile.objects.get_or_create(user=user)
        profile_fields = [
            "display_name", "phone_number", "bio",
            "license_number", "vehicle_number", "vehicle_type",
            "rc_number", "dob", "gender",
        ]
        for f in profile_fields:
            if f in attrs:
                setattr(profile, f, attrs[f])
        profile.save()

        # Update vehicle photo on the driver's primary vehicle
        if "vehicle_photo" in attrs:
            from operations.models import Vehicle
            vehicle = Vehicle.objects.filter(driver=user).first()
            if vehicle:
                vehicle.vehicle_photo = attrs["vehicle_photo"]
                vehicle.save(update_fields=["vehicle_photo"])

        data = self._get_merged_data(user)
        serializer = MergedDriverProfileSerializer(data)
        resp = success_response(data=serializer.data)
        return resp

# WALLET
# Signature/tolerance constants for the top-up pipeline. Any tolerance beyond
# these should be a deliberate product decision, never a silent default.
_MAX_TOPUP_AMOUNT = 100000
_MIN_TOPUP_AMOUNT = 10
# Guards the duplicate-key race on concurrent creates with the same
# idempotency key.
_IDEMPOTENCY_MAX_RETRIES = 3


class PaymentOrderSerializer(serializers.ModelSerializer):
    class Meta:
        model = PaymentOrder
        fields = (
            "id",
            "order_id",
            "amount",
            "currency",
            "status",
            "gateway",
            "gateway_payment_id",
            "failure_reason",
            "created_at",
            "paid_at",
        )
        read_only_fields = fields


class PaymentOrderCreateSerializer(serializers.Serializer):
    """
    Creates an *intent* only. The amount here never reaches a wallet — it is
    recorded on the order and re-verified against the gateway callback.
    """

    amount = serializers.DecimalField(
        max_digits=12,
        decimal_places=2,
        min_value=_MIN_TOPUP_AMOUNT,
        max_value=_MAX_TOPUP_AMOUNT,
    )
    currency = serializers.CharField(required=False, max_length=10, default="INR")
    idempotency_key = serializers.CharField(required=False, max_length=128)


class _ManualCreditSerializer(serializers.Serializer):
    """
    Admin-only ledger adjustment. Still cannot target another user's wallet:
    the target is always the requesting admin's own wallet.
    """

    amount = serializers.DecimalField(
        max_digits=12,
        decimal_places=2,
        min_value=1.00,
        max_value=_MAX_TOPUP_AMOUNT,
    )
    reason = serializers.CharField(max_length=255)


class WalletAPIView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        user = request.user
        user_id = request.query_params.get("user_id")
        if user_id and (request.user.role == ROLE_ADMIN or request.user.is_staff):
            try:
                user = User.objects.get(id=user_id)
            except User.DoesNotExist:
                return Response(
                    {"success": False, "message": "User not found"},
                    status=status.HTTP_404_NOT_FOUND,
                )

        wallet = WalletService.get_or_create_wallet(user)
        transactions = Transaction.objects.filter(wallet=wallet).order_by("-created_at")
        
        resp = success_response(
            data={
                "wallet": WalletSerializer(wallet).data,
                "transactions": TransactionSerializer(transactions, many=True).data
            }
        )
        return resp


class PaymentOrderCreateAPIView(APIView):
    """
    POST /api/accounts/wallet/orders/
    Create a top-up intent and return the server-generated order_id.

    This endpoint deliberately does NOT credit anything. The wallet is credited
    later, by PaymentWebhookAPIView, once the gateway has confirmed payment.
    """

    permission_classes = [IsAuthenticated]

    def post(self, request):
        serializer = PaymentOrderCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        idempotency_key = (
            request.headers.get("Idempotency-Key")
            or serializer.validated_data.get("idempotency_key")
        )
        if not idempotency_key:
            return error_response(
                message="Idempotency-Key header is required to create a top-up order.",
                status_code=status.HTTP_400_BAD_REQUEST,
            )

        user = request.user
        amount = serializer.validated_data["amount"]

        # Idempotent create: a replayed key returns the original order instead
        # of minting a second one.
        for attempt in range(_IDEMPOTENCY_MAX_RETRIES):
            existing = PaymentOrder.objects.filter(idempotency_key=idempotency_key).first()
            if existing:
                if existing.user_id != user.id:
                    return error_response(
                        message="Idempotency key already used by another account.",
                        status_code=status.HTTP_403_FORBIDDEN,
                    )
                return success_response(
                    data=PaymentOrderSerializer(existing).data,
                    message="Existing order returned for this idempotency key.",
                )

            try:
                with transaction.atomic():
                    order = PaymentOrder.objects.create(
                        user=user,
                        amount=amount,
                        currency=serializer.validated_data.get("currency") or "INR",
                        idempotency_key=idempotency_key,
                        status=PaymentOrder.STATUS_PENDING,
                        metadata={"source": "app_topup"},
                    )
                break
            except IntegrityError:
                # Lost the race against a concurrent create on the same key.
                if attempt == _IDEMPOTENCY_MAX_RETRIES - 1:
                    return error_response(
                        message="Could not create order, please retry.",
                        status_code=status.HTTP_409_CONFLICT,
                    )
        else:  # pragma: no cover - loop always breaks or returns
            return error_response(
                message="Could not create order, please retry.",
                status_code=status.HTTP_409_CONFLICT,
            )

        return success_response(
            data=PaymentOrderSerializer(order).data,
            message="Top-up order created. Awaiting payment.",
            status_code=status.HTTP_201_CREATED,
        )


class PaymentWebhookAPIView(APIView):
    """
    POST /api/accounts/wallet/webhook/
    Gateway callback. The ONLY path that may credit a wallet from a top-up.

    Order of checks is deliberate and each one is a hard stop:
      1. HMAC signature over the raw body (constant-time compare).
      2. Order exists and belongs to the stated user.
      3. Callback amount equals the amount stored on the order.
      4. Row lock + status re-read so concurrent webhooks cannot double-credit.
    """

    permission_classes = [AllowAny]

    def post(self, request):
        # A Django setting wins if one is ever added, otherwise fall back to the
        # process environment so the secret stays configurable via deployment
        # env vars without this module hard-coding a default.
        secret = getattr(settings, "PAYMENT_GATEWAY_WEBHOOK_SECRET", None) or os.environ.get(
            "PAYMENT_GATEWAY_WEBHOOK_SECRET"
        )
        if not secret:
            # Fail closed. An unset secret must never mean "accept everything".
            logger.error(
                "[PaymentWebhook] PAYMENT_GATEWAY_WEBHOOK_SECRET is not configured; rejecting."
            )
            return error_response(
                message="Webhook verification is not configured.",
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            )

        raw_body = request.body
        provided_signature = request.headers.get("X-Signature") or request.headers.get(
            "X-Webhook-Signature"
        )
        if not provided_signature:
            return error_response(
                message="Missing signature header.",
                status_code=status.HTTP_400_BAD_REQUEST,
            )

        expected_signature = hmac.new(
            secret.encode("utf-8"),
            raw_body,
            hashlib.sha256,
        ).hexdigest()

        # Constant-time compare; never use == on a signature.
        if not hmac.compare_digest(expected_signature, provided_signature.strip()):
            logger.warning("[PaymentWebhook] Signature mismatch; rejecting payload.")
            return error_response(
                message="Invalid signature.",
                status_code=status.HTTP_400_BAD_REQUEST,
            )

        try:
            payload = json.loads(raw_body.decode("utf-8"))
        except (ValueError, UnicodeDecodeError):
            return error_response(
                message="Malformed payload.", status_code=status.HTTP_400_BAD_REQUEST
            )

        order_id = payload.get("order_id")
        status_str = payload.get("status")
        gateway_payment_id = payload.get("payment_id") or payload.get("gateway_payment_id")
        gateway = payload.get("gateway")

        if not order_id or not status_str:
            return error_response(
                message="order_id and status are required.",
                status_code=status.HTTP_400_BAD_REQUEST,
            )

        # The amount is mandatory. An absent amount must never be treated as a
        # match, otherwise stripping the field would skip verification entirely.
        raw_amount = payload.get("amount")
        if raw_amount is None:
            return error_response(
                message="amount is required.",
                status_code=status.HTTP_400_BAD_REQUEST,
            )
        try:
            callback_amount = Decimal(str(raw_amount))
        except (InvalidOperation, TypeError, ValueError):
            return error_response(
                message="Invalid amount in payload.",
                status_code=status.HTTP_400_BAD_REQUEST,
            )

        # Only a known status may drive a transition. An unrecognised value is
        # never coerced into a valid one.
        if status_str not in PaymentOrder.ALL_STATUSES:
            return error_response(
                message=f"Unsupported status '{status_str}'.",
                status_code=status.HTTP_400_BAD_REQUEST,
            )

        with transaction.atomic():
            order = (
                PaymentOrder.objects.select_for_update()
                .select_related("user")
                .filter(order_id=order_id)
                .first()
            )
            if order is None:
                logger.warning(f"[PaymentWebhook] Unknown order_id: {order_id}")
                return error_response(
                    message="Unknown order.", status_code=status.HTTP_404_NOT_FOUND
                )

            if order.status in PaymentOrder.TERMINAL_STATUSES:
                # Gateway retry of an already-settled order. Acknowledge so the
                # gateway stops retrying; no second credit is possible.
                return success_response(
                    data=PaymentOrderSerializer(order).data,
                    message=f"Order already {order.status}.",
                )

            # The DB row is the authority. A tampered or mismatched amount is
            # rejected outright, never reconciled.
            if callback_amount != order.amount:
                logger.error(
                    f"[PaymentWebhook] Amount mismatch on {order_id}: "
                    f"callback={callback_amount} order={order.amount}. Rejecting."
                )
                return error_response(
                    message="Amount mismatch.",
                    status_code=status.HTTP_400_BAD_REQUEST,
                )

            if status_str == PaymentOrder.STATUS_SUCCEEDED:
                # WalletService.add_funds requires an existing row.
                WalletService.get_or_create_wallet(order.user)
                tx = WalletService.add_funds(
                    user=order.user,
                    amount=order.amount,  # server-side value, never the payload
                    reference=f"payorder_{order.order_id}",
                    metadata={
                        "source": "gateway_webhook",
                        "order_id": order.order_id,
                        "gateway_payment_id": gateway_payment_id or "",
                    },
                )
                order.status = PaymentOrder.STATUS_SUCCEEDED
                order.paid_at = timezone.now()
                order.wallet_transaction = tx
                if gateway:
                    order.gateway = gateway[:50]
                if gateway_payment_id:
                    order.gateway_payment_id = gateway_payment_id[:128]
                order.gateway_signature = provided_signature.strip()[:256]
                order.save(
                    update_fields=[
                        "status",
                        "paid_at",
                        "wallet_transaction",
                        "gateway",
                        "gateway_payment_id",
                        "gateway_signature",
                        "updated_at",
                    ]
                )
                logger.info(
                    f"[PaymentWebhook] Order {order_id} settled: {order.amount} "
                    f"{order.currency} credited to {order.user_id}."
                )
                return success_response(
                    data=PaymentOrderSerializer(order).data,
                    message="Payment captured.",
                )

            if status_str == PaymentOrder.STATUS_FAILED:
                order.status = PaymentOrder.STATUS_FAILED
                order.failure_reason = str(payload.get("failure_reason") or "")[:255]
                if gateway:
                    order.gateway = gateway[:50]
                if gateway_payment_id:
                    order.gateway_payment_id = gateway_payment_id[:128]
                order.save(
                    update_fields=[
                        "status",
                        "failure_reason",
                        "gateway",
                        "gateway_payment_id",
                        "updated_at",
                    ]
                )
                return success_response(
                    data=PaymentOrderSerializer(order).data,
                    message="Payment failed.",
                )

            # Reached only for 'pending' or 'processing' (unknown values were
            # rejected above). Record progress; the order stays non-terminal so
            # a later 'succeeded' callback can still settle it.
            order.status = PaymentOrder.STATUS_PROCESSING
            order.save(update_fields=["status", "updated_at"])
            return success_response(
                data=PaymentOrderSerializer(order).data,
                message="Payment processing.",
                status_code=status.HTTP_202_ACCEPTED,
            )


class AddFundsAPIView(APIView):
    """
    POST /api/accounts/wallet/add-funds/
    Admin-only manual ledger credit (cash top-up at a depot, support goodwill
    adjustment). This is NOT the top-up pipeline — passengers cannot credit
    themselves here; use POST /wallet/orders/ + the gateway webhook.
    """

    permission_classes = [IsAuthenticated, IsAdmin]

    def post(self, request):
        # Belt-and-braces: the permission class already gates this, but the
        # 403 must not depend on a single check.
        if not (request.user.role == ROLE_ADMIN or request.user.is_staff):
            return error_response(
                message=IsAdmin.message,
                status_code=status.HTTP_403_FORBIDDEN,
            )

        serializer = _ManualCreditSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        amount = serializer.validated_data["amount"]
        reason = serializer.validated_data["reason"]

        WalletService.get_or_create_wallet(request.user)
        tx = WalletService.add_funds(
            user=request.user,
            amount=amount,
            reference=f"manual_{request.user.id}_{timezone.now().timestamp()}",
            metadata={
                "source": "admin_manual_credit",
                "reason": reason,
                "credited_by": str(request.user.id),
                "credited_by_role": request.user.role,
            },
        )

        resp = success_response(
            data=TransactionSerializer(tx).data,
            message="Funds added successfully",
            status_code=status.HTTP_201_CREATED
        )
        return resp

# DRIVER DOCUMENTS (KYC)
class DriverDocumentAPIView(APIView):
    permission_classes = [IsAuthenticated, IsDriverOrAdmin]

    def _target_driver(self, request):
        user_id = request.query_params.get("user_id") or request.data.get("user_id")
        is_admin = request.user.role == ROLE_ADMIN or request.user.is_staff
        if user_id and is_admin:
            try:
                target = User.objects.get(id=user_id)
            except (User.DoesNotExist, ValueError, TypeError):
                return None
            return target if target.role in (ROLE_BIKE_DRIVER, ROLE_AUTO_DRIVER) else None
        if user_id and not is_admin:
            return None
        return request.user

    def get(self, request, doc_id=None, **kwargs):
        driver = self._target_driver(request)
        if driver is None:
            return Response(
                {"success": False, "message": "User not found"},
                status=status.HTTP_404_NOT_FOUND,
            )

        if doc_id:
            try:
                doc = DriverDocument.objects.get(id=doc_id, driver=driver)
            except DriverDocument.DoesNotExist:
                return Response(
                    {"success": False, "message": "Document not found"},
                    status=status.HTTP_404_NOT_FOUND,
                )
            return Response(DriverDocumentSerializer(doc).data)
        docs = DriverDocument.objects.filter(driver=driver)
        resp = Response(DriverDocumentListSerializer(docs, many=True).data)
        return resp

    def delete(self, request, doc_id=None):
        if not doc_id:
            return Response(
                {"success": False, "message": "doc_id path parameter is required"},
                status=status.HTTP_400_BAD_REQUEST,
            )
        driver = self._target_driver(request)
        if driver is None:
            return Response(
                {"success": False, "message": "User not found"},
                status=status.HTTP_404_NOT_FOUND,
            )
        try:
            doc = DriverDocument.objects.get(id=doc_id, driver=driver)
            doc.delete()
            return Response(
                {"success": True, "message": "Document deleted"},
                status=status.HTTP_200_OK,
            )
        except DriverDocument.DoesNotExist:
            return Response(
                {"success": False, "message": "Document not found"},
                status=status.HTTP_404_NOT_FOUND,
            )

    def post(self, request, **kwargs):
        import base64
        import uuid as uuid_mod

        driver = self._target_driver(request)
        if driver is None:
            return Response(
                {"success": False, "message": "A valid driver user_id is required for admin uploads."},
                status=status.HTTP_404_NOT_FOUND,
            )

        PublicDriverProfile.objects.get_or_create(
            user=driver,
            defaults={
                "display_name": driver.get_full_name() or driver.email.split("@", 1)[0],
                "vehicle_type": "bike" if driver.role == ROLE_BIKE_DRIVER else "auto",
            },
        )

        document_type = request.data.get("document_type", "")
        doc_key = request.data.get("doc_key", "")
        file_obj = request.data.get("file")
        file_base64 = request.data.get("file_base64")
        file_name = request.data.get("file_name", "upload.jpg")

        if not document_type:
            return Response(
                {"success": False, "message": "document_type is required"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        existing_doc = None
        if doc_key:
            existing_doc = DriverDocument.objects.filter(
                driver=driver, doc_key=doc_key
            ).first()

        if file_base64:
            if "," in file_base64:
                file_base64 = file_base64.split(",", 1)[1]
            try:
                base64.b64decode(file_base64)
            except Exception:
                return Response(
                    {"success": False, "message": "Invalid base64 data"},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            if existing_doc:
                existing_doc.file_data = file_base64
                existing_doc.file_name = file_name
                existing_doc.document_type = document_type
                existing_doc.status = DOC_STATUS_PENDING
                existing_doc.rejection_reason = ""
                existing_doc.verified_by = None
                existing_doc.verified_at = None
                existing_doc.save()
                from accounts.services.verification_service import VerificationService
                VerificationService.check_and_verify_profile(driver)
                return Response(
                    DriverDocumentSerializer(existing_doc).data,
                    status=status.HTTP_200_OK,
                )
            doc = DriverDocument.objects.create(
                driver=driver,
                document_type=document_type,
                doc_key=doc_key or "",
                file_data=file_base64,
                file_name=file_name,
            )
            from accounts.services.verification_service import VerificationService
            VerificationService.check_and_verify_profile(driver)
            return Response(
                DriverDocumentSerializer(doc).data,
                status=status.HTTP_201_CREATED,
            )

        if file_obj:
            allowed_types = {"application/pdf", "image/jpeg", "image/png", "image/webp"}
            if getattr(file_obj, "content_type", "") not in allowed_types:
                return Response(
                    {"success": False, "message": "Upload a PDF, JPG, PNG, or WEBP file."},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            if getattr(file_obj, "size", 0) > 10 * 1024 * 1024:
                return Response(
                    {"success": False, "message": "Documents must be 10 MB or smaller."},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            try:
                file_bytes = file_obj.read()
                encoded = base64.b64encode(file_bytes).decode("utf-8")
                actual_name = getattr(file_obj, "name", file_name) or file_name
            except Exception:
                return Response(
                    {"success": False, "message": "Failed to read uploaded file"},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            if existing_doc:
                existing_doc.file_data = encoded
                existing_doc.file_name = actual_name
                existing_doc.document_type = document_type
                existing_doc.status = DOC_STATUS_PENDING
                existing_doc.rejection_reason = ""
                existing_doc.verified_by = None
                existing_doc.verified_at = None
                existing_doc.save()
                from accounts.services.verification_service import VerificationService
                VerificationService.check_and_verify_profile(driver)
                return Response(
                    DriverDocumentSerializer(existing_doc).data,
                    status=status.HTTP_200_OK,
                )
            doc = DriverDocument.objects.create(
                driver=driver,
                document_type=document_type,
                doc_key=doc_key or "",
                file_data=encoded,
                file_name=actual_name,
            )
            from accounts.services.verification_service import VerificationService
            VerificationService.check_and_verify_profile(driver)
            return Response(
                DriverDocumentSerializer(doc).data,
                status=status.HTTP_201_CREATED,
            )

        return Response(
            {"success": False, "message": "file or file_base64 is required"},
            status=status.HTTP_400_BAD_REQUEST,
        )


# DRIVER BANK DETAILS
class DriverBankDetailAPIView(APIView):
    permission_classes = [IsAuthenticated, IsDriver]

    def get(self, request):
        detail, _ = DriverBankDetail.objects.get_or_create(driver=request.user)
        serializer = DriverBankDetailSerializer(detail)
        return success_response(data=serializer.data)

    def post(self, request):
        serializer = DriverBankDetailUpdateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        attrs = serializer.validated_data

        detail, _ = DriverBankDetail.objects.get_or_create(driver=request.user)
        for f in ["holder_name", "account_number", "ifsc", "upi"]:
            if f in attrs:
                setattr(detail, f, attrs[f])
        detail.save()

        return success_response(
            data=DriverBankDetailSerializer(detail).data,
            message="Bank details saved",
        )


# VERIFICATION STATUS
class VerificationStatusAPIView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        return success_response(data=_driver_verification_payload(request.user))

# RECENT SEARCHES — Redis-first with 48h TTL, DB as durable backup
_RECENT_SEARCH_TTL = 172800  # 48 hours in seconds
_RECENT_SEARCH_MAX = 20


def _redis_key(user_id):
    return f"recent_searches:{user_id}"


def _load_from_redis(user_id):
    raw = cache.get(_redis_key(user_id))
    if raw is None:
        return None
    try:
        return json.loads(raw)
    except (json.JSONDecodeError, TypeError):
        # Corrupt data — delete key so next read warms fresh from DB
        cache.delete(_redis_key(user_id))
        logger.warning(f"Corrupt recent search cache for user {user_id}, deleted key")
        return None


def _save_to_redis(user_id, items):
    cache.set(_redis_key(user_id), json.dumps(items), _RECENT_SEARCH_TTL)


def _warm_redis_from_db(user):
    """Load recent searches from DB into Redis (called on cache miss)."""
    searches = RecentSearch.objects.filter(user=user)[:_RECENT_SEARCH_MAX]
    items = [
        {
            "id": str(s.id),
            "pickup_name": s.pickup_name,
            "pickup_lat": s.pickup_lat,
            "pickup_lon": s.pickup_lon,
            "destination_name": s.destination_name,
            "destination_lat": s.destination_lat,
            "destination_lon": s.destination_lon,
            "created_at": s.created_at.isoformat(),
        }
        for s in searches
    ]
    if items:
        _save_to_redis(user.id, items)
    return items


def _search_matches_existing(search_data, existing_items):
    """Check if a search matches any existing item by lat/lon coordinates."""
    for item in existing_items:
        if (
            abs(item.get("pickup_lat", 0) - search_data["pickup_lat"]) < 1e-6
            and abs(item.get("pickup_lon", 0) - search_data["pickup_lon"]) < 1e-6
            and abs(item.get("destination_lat", 0) - search_data["destination_lat"]) < 1e-6
            and abs(item.get("destination_lon", 0) - search_data["destination_lon"]) < 1e-6
        ):
            return True
    return False


class RecentSearchAPIView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        user = request.user

        # 1. Try Redis first
        items = _load_from_redis(user.id)
        if items is None:
            # Cache miss — warm from DB
            items = _warm_redis_from_db(user)

        serializer = RecentSearchSerializer(
            [self._item_to_obj(item) for item in items[:10]],
            many=True,
        )
        return success_response(data=serializer.data)

    def post(self, request):
        serializer = RecentSearchCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        user = request.user
        search_data = {
            "pickup_name": data.get("pickup_name", ""),
            "pickup_lat": data["pickup_lat"],
            "pickup_lon": data["pickup_lon"],
            "destination_name": data.get("destination_name", ""),
            "destination_lat": data["destination_lat"],
            "destination_lon": data["destination_lon"],
        }

        # 1. Load existing from Redis (or DB fallback)
        items = _load_from_redis(user.id)
        if items is None:
            items = _warm_redis_from_db(user)

        # 2. Check for duplicate in Redis items
        if _search_matches_existing(search_data, items):
            # Find the existing item to return
            for item in items:
                if (
                    abs(item.get("pickup_lat", 0) - search_data["pickup_lat"]) < 1e-6
                    and abs(item.get("pickup_lon", 0) - search_data["pickup_lon"]) < 1e-6
                    and abs(item.get("destination_lat", 0) - search_data["destination_lat"]) < 1e-6
                    and abs(item.get("destination_lon", 0) - search_data["destination_lon"]) < 1e-6
                ):
                    return success_response(
                        data=self._serialize_item(item),
                        message="Search already exists.",
                        status_code=status.HTTP_200_OK,
                    )

        # 3. Check DB for duplicate (handles case where Redis expired but DB has it)
        existing_db = RecentSearch.objects.filter(
            user=user,
            pickup_lat=search_data["pickup_lat"],
            pickup_lon=search_data["pickup_lon"],
            destination_lat=search_data["destination_lat"],
            destination_lon=search_data["destination_lon"],
        ).first()

        if existing_db:
            # Touch Redis: reload from DB
            items = _warm_redis_from_db(user)
            return success_response(
                data=RecentSearchSerializer(existing_db).data,
                message="Search already exists.",
                status_code=status.HTTP_200_OK,
            )

        # 4. Create in DB
        db_search = RecentSearch.objects.create(
            user=user,
            pickup_name=search_data["pickup_name"],
            pickup_lat=search_data["pickup_lat"],
            pickup_lon=search_data["pickup_lon"],
            destination_name=search_data["destination_name"],
            destination_lat=search_data["destination_lat"],
            destination_lon=search_data["destination_lon"],
        )

        # 5. Prepend to Redis list, dedup, trim to max
        new_item = {
            "id": str(db_search.id),
            "pickup_name": search_data["pickup_name"],
            "pickup_lat": search_data["pickup_lat"],
            "pickup_lon": search_data["pickup_lon"],
            "destination_name": search_data["destination_name"],
            "destination_lat": search_data["destination_lat"],
            "destination_lon": search_data["destination_lon"],
            "created_at": db_search.created_at.isoformat(),
        }
        items.insert(0, new_item)
        # Dedup (keep first occurrence only)
        seen = set()
        deduped = []
        for item in items:
            key = (item["pickup_lat"], item["pickup_lon"], item["destination_lat"], item["destination_lon"])
            if key not in seen:
                seen.add(key)
                deduped.append(item)
        items = deduped[:_RECENT_SEARCH_MAX]
        _save_to_redis(user.id, items)

        # 6. Trim DB to keep only the latest 20
        RecentSearch.objects.filter(user=user).exclude(
            id__in=RecentSearch.objects.filter(user=user).order_by("-created_at")[:_RECENT_SEARCH_MAX].values("id")
        ).delete()

        return success_response(
            data=RecentSearchSerializer(db_search).data,
            message="Search saved.",
            status_code=status.HTTP_201_CREATED,
        )

    def _item_to_obj(self, item):
        """Convert a raw dict item to a mock object for the serializer."""
        class MockObj:
            pass
        obj = MockObj()
        obj.id = item.get("id", "")
        obj.pickup_name = item.get("pickup_name", "")
        obj.pickup_lat = item.get("pickup_lat", 0)
        obj.pickup_lon = item.get("pickup_lon", 0)
        obj.destination_name = item.get("destination_name", "")
        obj.destination_lat = item.get("destination_lat", 0)
        obj.destination_lon = item.get("destination_lon", 0)
        return obj

    def _serialize_item(self, item):
        """Serialize a raw dict item directly."""
        return {
            "id": item.get("id", ""),
            "pickup": {
                "lat": item.get("pickup_lat", 0),
                "lon": item.get("pickup_lon", 0),
                "name": item.get("pickup_name", ""),
                "display_name": item.get("pickup_name", ""),
            },
            "destination": {
                "lat": item.get("destination_lat", 0),
                "lon": item.get("destination_lon", 0),
                "name": item.get("destination_name", ""),
                "display_name": item.get("destination_name", ""),
            },
            "created_at": item.get("created_at", ""),
        }

# USERS (ADMIN ONLY)

class UserViewSet(
    viewsets.ModelViewSet
):
    queryset = User.objects.all()
    serializer_class = UserSerializer
    permission_classes = [
        IsAuthenticated,
        IsAdmin,
    ]
    filterset_fields = [
        "role",
        "city",
        "is_verified",
    ]

    def get_serializer_class(self):
        if self.action in ("create", "update", "partial_update"):
            return UserCreateUpdateSerializer
        return UserSerializer

    def _add_verification_payload(self, data):
        """Attach canonical document/KYC status to admin user responses."""
        if isinstance(data, dict) and isinstance(data.get("results"), list):
            # DRF pagination wraps rows under `results`; preserve pagination metadata.
            self._add_verification_payload(data["results"])
            return data

        if isinstance(data, list):
            user_ids = [item.get("id") for item in data if item.get("id")]
            users_by_id = {str(user.pk): user for user in User.objects.filter(pk__in=user_ids)}
            for item in data:
                user = users_by_id.get(str(item.get("id")))
                if user:
                    item["verification"] = _driver_verification_payload(user)
            return data

        if isinstance(data, dict) and data.get("id"):
            user = User.objects.filter(pk=data["id"]).first()
            if user:
                data["verification"] = _driver_verification_payload(user)
        return data

    def list(self, request, *args, **kwargs):
        resp = super().list(request, *args, **kwargs)
        resp.data = self._add_verification_payload(resp.data)
        return resp

    def retrieve(self, request, *args, **kwargs):
        resp = super().retrieve(request, *args, **kwargs)
        resp.data = self._add_verification_payload(resp.data)
        return resp

    @action(detail=True, methods=["post"], url_path="send-verification")
    def send_verification(self, request, pk=None):
        """Queue a fresh email verification OTP for an admin-selected user."""
        user = self.get_object()
        if user.is_verified:
            return Response({"success": True, "message": "This user's email is already verified."})
        otp = OTPService.create_otp(user)
        try:
            from communication.tasks import send_otp_task
            send_otp_task.delay(user.id, otp)
        except Exception:
            logger.exception("Could not queue verification email for user %s", user.id)
            return Response(
                {"success": False, "message": "Could not queue the verification email. Please try again."},
                status=status.HTTP_503_SERVICE_UNAVAILABLE,
            )
        return Response({"success": True, "message": f"Verification code queued for {user.email}.", "email": user.email})


class PushTokenAPIView(APIView):
    """
    POST /api/accounts/push-token/
    Register or update Expo push notification token for the authenticated user.
    """
    permission_classes = [IsAuthenticated]

    def post(self, request):
        # The clients send {"push_token": ...} (see
        # BikeFindPassengerScreen.jsx) while this endpoint only ever read
        # "token", so every registration was rejected with 400 and the app
        # swallowed it with .catch(() => {}) - leaving User.push_token empty and
        # no push notification deliverable. Accept both spellings.
        token = request.data.get("token") or request.data.get("push_token")
        if not token:
            return Response(
                {"success": False, "message": "token is required"},
                status=status.HTTP_400_BAD_REQUEST,
            )
        user = request.user
        user.push_token = token
        user.save(update_fields=["push_token"])
        return Response({"success": True, "message": "Push token updated"})
