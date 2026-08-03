from django.urls import path, include
from rest_framework.routers import DefaultRouter
from rest_framework_simplejwt.views import TokenRefreshView

from accounts.api.views import (
    RegisterAPIView,
    LoginAPIView,
    VerifyOTPAPIView,
    ResendOTPAPIView,
    ForgotPasswordAPIView,
    ResetPasswordAPIView,
    ChangePasswordAPIView,
    CurrentUserAPIView,
    PassengerProfileAPIView,
    DriverProfileAPIView,
    WalletAPIView,
    AddFundsAPIView,
    DriverDocumentAPIView,
    RecentSearchAPIView,
    UserViewSet,
    PushTokenAPIView,
)

router = DefaultRouter()
router.register(r"users", UserViewSet, basename="user")

urlpatterns = [
    path("", include(router.urls)),
    # Auth
    path("register/", RegisterAPIView.as_view()),
    path("login/", LoginAPIView.as_view()),
    path("verify-otp/", VerifyOTPAPIView.as_view()),
    path("resend-otp/", ResendOTPAPIView.as_view()),
    path("forgot-password/", ForgotPasswordAPIView.as_view()),
    path("reset-password/", ResetPasswordAPIView.as_view()),
    path("change-password/", ChangePasswordAPIView.as_view()),
    path("token/refresh/", TokenRefreshView.as_view()),

    # Current User
    path("me/", CurrentUserAPIView.as_view()),

    # Profiles
    path(
        "me/passenger-profile/",
        PassengerProfileAPIView.as_view(),
    ),

    path(
        "me/driver-profile/",
        DriverProfileAPIView.as_view(),
    ),

    # Financial
    path("wallet/", WalletAPIView.as_view()),
    path("wallet/add-funds/", AddFundsAPIView.as_view()),

    # KYC
    path("driver/documents/", DriverDocumentAPIView.as_view()),

    # Recent Searches
    path("recent-searches/", RecentSearchAPIView.as_view()),

    # Push Notifications
    path("push-token/", PushTokenAPIView.as_view()),
]
