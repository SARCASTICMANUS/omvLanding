from django.urls import path
from operations.api.views import (
    RideEstimateAPIView,
    TripRatingAPIView,
    TripHistoryAPIView,
    DriverEarningsAPIView,
    TripFareDetailAPIView,
)

urlpatterns = [
    path('estimate/', RideEstimateAPIView.as_view(), name='ride-estimate'),
    path('rating/', TripRatingAPIView.as_view(), name='trip-rating'),
    path('history/', TripHistoryAPIView.as_view(), name='trip-history'),
    path('earnings/', DriverEarningsAPIView.as_view(), name='driver-earnings'),
    path('trip/<uuid:trip_id>/fare/', TripFareDetailAPIView.as_view(), name='trip-fare'),
]
