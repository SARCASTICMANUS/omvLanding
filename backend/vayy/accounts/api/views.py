import json
import logging
from django.utils import timezone
from django.core.cache import cache
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
    DriverBankDetail,
)

from common.constants import (
    DOC_STATUS_PENDING,
    DOC_STATUS_VERIFIED,
    DOC_STATUS_REJECTED,
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
    AddFundsSerializer,
    DriverDocumentSerializer,
    RecentSearchSerializer,
    RecentSearchCreateSerializer,
    DriverBankDetailSerializer,
    DriverBankDetailUpdateSerializer,
)

from accounts.services.auth_service import AuthService
from accounts.services.wallet_service import WalletService
from accounts.permissions import (
    IsAdmin,
    IsDriver,
    IsDriverOrAdmin,
    IsPassenger,
    IsPassengerOrAdmin,
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
            message="Registration successful. Safety Code sent.",
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

# CURRENT USER
class CurrentUserAPIView(APIView):
    permission_classes = [
        IsAuthenticated
    ]

    def get(self, request):
        resp = success_response(
            data=UserSerializer(
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
        if user_id and request.user.role == ROLE_ADMIN:
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
        if user_id and request.user.role == ROLE_ADMIN:
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
            "dob": profile.dob.isoformat() if profile.dob else None,
            "gender": profile.gender,
            "is_verified": profile.is_verified,
            "rating": profile.rating,
            "total_trips": profile.total_trips,
        }

    def _get_target_user(self, request):
        user_id = request.query_params.get("user_id")
        if user_id and request.user.role == ROLE_ADMIN:
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
        if user_id and request.user.role == ROLE_ADMIN:
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
            "dob", "gender",
        ]
        for f in profile_fields:
            if f in attrs:
                setattr(profile, f, attrs[f])
        profile.save()

        data = self._get_merged_data(user)
        serializer = MergedDriverProfileSerializer(data)
        resp = success_response(data=serializer.data)
        return resp

# WALLET
class WalletAPIView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        wallet = WalletService.get_or_create_wallet(request.user)
        transactions = Transaction.objects.filter(wallet=wallet).order_by("-created_at")
        
        resp = success_response(
            data={
                "wallet": WalletSerializer(wallet).data,
                "transactions": TransactionSerializer(transactions, many=True).data
            }
        )
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
        
        resp = success_response(
            data=TransactionSerializer(tx).data,
            message="Funds added successfully",
            status_code=status.HTTP_201_CREATED
        )
        return resp

# DRIVER DOCUMENTS (KYC)
class DriverDocumentAPIView(APIView):
    permission_classes = [IsAuthenticated, IsDriver]

    def get(self, request):
        docs = DriverDocument.objects.filter(driver=request.user)
        resp = Response(DriverDocumentSerializer(docs, many=True).data)
        return resp

    def post(self, request):
        import base64
        import uuid as uuid_mod
        from django.core.files.base import ContentFile

        document_type = request.data.get("document_type", "")
        file_obj = request.data.get("file")
        file_base64 = request.data.get("file_base64")
        file_name = request.data.get("file_name", "upload.jpg")

        if not document_type:
            return Response(
                {"success": False, "message": "document_type is required"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if file_base64:
            # Accept base64-encoded image
            if "," in file_base64:
                file_base64 = file_base64.split(",", 1)[1]
            try:
                decoded = base64.b64decode(file_base64)
            except Exception:
                return Response(
                    {"success": False, "message": "Invalid base64 data"},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            ext = file_name.rsplit(".", 1)[-1] if "." in file_name else "jpg"
            unique_name = f"{uuid_mod.uuid4().hex}.{ext}"
            content = ContentFile(decoded, name=unique_name)
            doc = DriverDocument.objects.create(
                driver=request.user,
                document_type=document_type,
                file=content,
            )
            return Response(
                DriverDocumentSerializer(doc).data,
                status=status.HTTP_201_CREATED,
            )

        if file_obj:
            serializer = DriverDocumentSerializer(data=request.data)
            serializer.is_valid(raise_exception=True)
            serializer.save(driver=request.user)
            return Response(serializer.data, status=status.HTTP_201_CREATED)

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
        user = request.user
        is_driver = user.role in (ROLE_BIKE_DRIVER, ROLE_AUTO_DRIVER)

        if not is_driver:
            return success_response(data={
                "is_verified": user.is_verified,
                "status": "verified" if user.is_verified else "unverified",
                "documents": [],
            })

        docs = DriverDocument.objects.filter(driver=user)
        doc_list = DriverDocumentSerializer(docs, many=True).data

        profile = PublicDriverProfile.objects.filter(user=user).first()
        profile_verified = profile.is_verified if profile else False

        statuses = [d["status"] for d in doc_list]
        if profile_verified:
            verification_status = "verified"
        elif not doc_list:
            verification_status = "not_submitted"
        elif DOC_STATUS_REJECTED in statuses:
            verification_status = "rejected"
        elif all(s == DOC_STATUS_VERIFIED for s in statuses):
            verification_status = "verified"
        else:
            verification_status = "pending"

        return success_response(data={
            "is_verified": profile_verified or user.is_verified,
            "status": verification_status,
            "documents": doc_list,
        })

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
