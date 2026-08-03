import logging
from django.utils import timezone
from rest_framework import status, viewsets
from rest_framework.views import APIView
from rest_framework.permissions import (
    IsAuthenticated,
    AllowAny,
)
from rest_framework.response import Response

from accounts.models import (
    User,
    PublicPassengerProfile,
    PublicDriverProfile,
    Wallet,
    Transaction,
    PaymentMethod,
    DriverDocument,
    RecentSearch,
)

from accounts.api.serializers import (
    UserSerializer,
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
    AddFundsSerializer,
    DriverDocumentSerializer,
    RecentSearchSerializer,
    RecentSearchCreateSerializer,
)

from accounts.services.auth_service import AuthService
from accounts.services.wallet_service import WalletService
from accounts.permissions import (
    IsAdmin,
    IsDriver,
    IsPassenger,
)
from common.responses import success_response, error_response

logger = logging.getLogger(__name__)

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
            message="Registration successful. OTP sent.",
            status_code=status.HTTP_201_CREATED
        )
        return resp

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
            message="OTP resent successfully."
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
            message="Password reset OTP sent."
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
        resp = Response(
            {
                "message": "Password changed successfully."
            }
        )
        return resp

# CURRENT USER
class CurrentUserAPIView(APIView):
    permission_classes = [
        IsAuthenticated
    ]

    def get(self, request):
        resp = Response(
            UserSerializer(
                request.user
            ).data
        )
        return resp

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

        resp = Response(
            UserSerializer(
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
        IsPassenger,
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

    def get(self, request):
        data = self._get_merged_data(request.user)
        serializer = MergedPassengerProfileSerializer(data)
        resp = Response(serializer.data)
        return resp

    def put(self, request):
        update_ser = MergedPassengerProfileUpdateSerializer(data=request.data)
        update_ser.is_valid(raise_exception=True)
        attrs = update_ser.validated_data

        # Update User fields
        user = request.user
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
        resp = Response(serializer.data)
        return resp

# DRIVER PROFILE
class DriverProfileAPIView(APIView):
    permission_classes = [
        IsAuthenticated,
        IsDriver,
    ]

    def _get_merged_data(self, user):
        """Build a flat dict with User + Profile fields."""
        profile, _ = PublicDriverProfile.objects.get_or_create(
            user=user,
            defaults={
                "display_name": user.get_full_name() or user.email.split("@")[0],
            },
        )

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
            "is_verified": profile.is_verified,
            "rating": profile.rating,
            "total_trips": profile.total_trips,
        }

    def get(self, request):
        data = self._get_merged_data(request.user)
        serializer = MergedDriverProfileSerializer(data)
        resp = Response(serializer.data)
        return resp

    def put(self, request):
        update_ser = MergedDriverProfileUpdateSerializer(data=request.data)
        update_ser.is_valid(raise_exception=True)
        attrs = update_ser.validated_data

        # Update User fields
        user = request.user
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
        ]
        for f in profile_fields:
            if f in attrs:
                setattr(profile, f, attrs[f])
        profile.save()

        data = self._get_merged_data(user)
        serializer = MergedDriverProfileSerializer(data)
        resp = Response(serializer.data)
        return resp

# WALLET
class WalletAPIView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        wallet = WalletService.get_or_create_wallet(request.user)
        transactions = Transaction.objects.filter(wallet=wallet).order_by("-created_at")
        
        resp = Response({
            "wallet": WalletSerializer(wallet).data,
            "transactions": TransactionSerializer(transactions, many=True).data
        })
        return resp

class AddFundsAPIView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        serializer = AddFundsSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        
        # In a real app, integrate with a payment gateway here
        tx = WalletService.add_funds(
            user=request.user,
            amount=serializer.validated_data["amount"],
            reference=f"manual_{request.user.id}_{timezone.now().timestamp()}",
            metadata={"source": "app_manual_add"}
        )
        
        resp = Response(TransactionSerializer(tx).data, status=status.HTTP_201_CREATED)
        return resp

# DRIVER DOCUMENTS (KYC)
class DriverDocumentAPIView(APIView):
    permission_classes = [IsAuthenticated, IsDriver]

    def get(self, request):
        docs = DriverDocument.objects.filter(driver=request.user)
        resp = Response(DriverDocumentSerializer(docs, many=True).data)
        return resp

    def post(self, request):
        serializer = DriverDocumentSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        serializer.save(driver=request.user)
        resp = Response(serializer.data, status=status.HTTP_201_CREATED)
        return resp

# RECENT SEARCHES
class RecentSearchAPIView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        searches = RecentSearch.objects.filter(
            user=request.user
        )[:10]
        serializer = RecentSearchSerializer(searches, many=True)
        resp = success_response(data=serializer.data)
        return resp

    def post(self, request):
        serializer = RecentSearchCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        search = RecentSearch.objects.create(
            user=request.user,
            pickup_name=serializer.validated_data.get("pickup_name", ""),
            pickup_lat=serializer.validated_data["pickup_lat"],
            pickup_lon=serializer.validated_data["pickup_lon"],
            destination_name=serializer.validated_data.get("destination_name", ""),
            destination_lat=serializer.validated_data["destination_lat"],
            destination_lon=serializer.validated_data["destination_lon"],
        )
        # Keep only last 20 searches per user
        RecentSearch.objects.filter(user=request.user).exclude(
            id__in=RecentSearch.objects.filter(user=request.user)[:20].values("id")
        ).delete()
        resp = success_response(
            data=RecentSearchSerializer(search).data,
            message="Search saved.",
            status_code=status.HTTP_201_CREATED,
        )
        return resp

# USERS (ADMIN ONLY)

class UserViewSet(
    viewsets.ReadOnlyModelViewSet
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

    def list(self, request, *args, **kwargs):
        resp = super().list(request, *args, **kwargs)
        return resp

    def retrieve(self, request, *args, **kwargs):
        resp = super().retrieve(request, *args, **kwargs)
        return resp


class PushTokenAPIView(APIView):
    """
    POST /api/accounts/push-token/
    Register or update Expo push notification token for the authenticated user.
    """
    permission_classes = [IsAuthenticated]

    def post(self, request):
        token = request.data.get("token")
        if not token:
            return Response(
                {"success": False, "message": "token is required"},
                status=status.HTTP_400_BAD_REQUEST,
            )
        user = request.user
        user.push_token = token
        user.save(update_fields=["push_token"])
        return Response({"success": True, "message": "Push token updated"})
