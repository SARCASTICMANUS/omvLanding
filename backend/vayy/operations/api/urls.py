from django.urls import path

from operations.api.views import (
    VehicleListAPIView,
    VehicleDetailAPIView,
    DriverVehicleAPIView,
    VehicleStateAPIView,
    ActiveTripListAPIView,
    ActiveTripDetailAPIView,
    DriverActiveTripAPIView,
    StartTripAPIView,
    # CompleteTripAPIView,
    TripNextStopsAPIView,
    TripBoardingRequestListAPIView,
    BoardingRequestListAPIView,
    BoardingRequestDetailAPIView,
    BoardingRequestBoardedAPIView,
    DispatchRequestAPIView,
    DispatchAssignAPIView,
    DispatchDetailAPIView,
    DispatchCancelAPIView,
    DispatchAcceptAPIView,
    DispatchRejectAPIView,
    DispatchArrivedAPIView,
    DispatchStartAPIView,
    DispatchCompleteAPIView,
    BroadcastAcceptAPIView,
    BroadcastRejectAPIView,
    BroadcastCancelAPIView,
    VehicleRegistrationAPIView,
    AdminPendingDriversAPIView,
    AdminDriverVerifyAPIView,
    AdminDocumentVerifyAPIView,
    AdminDocumentFileAPIView,
    FareConfigurationListCreateAPIView,
    FareConfigurationQuoteAPIView,
)

urlpatterns = [
    path(
        "vehicles/",
        VehicleListAPIView.as_view(),
        name="vehicle-list",
    ),
    path(
        "vehicles/me/",
        DriverVehicleAPIView.as_view(),
        name="driver-vehicle",
    ),

    path(
        "vehicles/<uuid:vehicle_id>/",
        VehicleDetailAPIView.as_view(),
        name="vehicle-detail",
    ),
    path(
        "vehicles/<uuid:vehicle_id>/state/",
        VehicleStateAPIView.as_view(),
        name="vehicle-state",
    ),

    path(
        "trips/",
        ActiveTripListAPIView.as_view(),
        name="trip-list",
    ),
    path(
        "trips/start/",
        StartTripAPIView.as_view(),
        name="trip-start",
    ),
    path(
        "trips/me/active/",
        DriverActiveTripAPIView.as_view(),
        name="driver-active-trip",
    ),

    path(
        "trips/<uuid:trip_id>/",
        ActiveTripDetailAPIView.as_view(),
        name="trip-detail",
    ),
    # path(
    #     "trips/<uuid:trip_id>/complete/",
    #     CompleteTripAPIView.as_view(),
    #     name="trip-complete",
    # ),
    path(
        "trips/<uuid:trip_id>/next-stops/",
        TripNextStopsAPIView.as_view(),
        name="trip-next-stops",
    ),
    path(
        "trips/<uuid:trip_id>/boarding-requests/",
        TripBoardingRequestListAPIView.as_view(),
        name="trip-boarding-requests",
    ),

    path(
        "boarding-requests/",
        BoardingRequestListAPIView.as_view(),
        name="boarding-request-list",
    ),
    path(
        "boarding-requests/<uuid:request_id>/",
        BoardingRequestDetailAPIView.as_view(),
        name="boarding-request-detail",
    ),
    path(
        "boarding-requests/<uuid:request_id>/boarded/",
        BoardingRequestBoardedAPIView.as_view(),
        name="boarding-request-boarded",
    ),

    # Dispatch Endpoints
    path(
        "dispatch/request/",
        DispatchRequestAPIView.as_view(),
        name="dispatch-request",
    ),
    path(
        "dispatch/assign/",
        DispatchAssignAPIView.as_view(),
        name="dispatch-assign",
    ),
    path(
        "dispatch/<uuid:trip_id>/",
        DispatchDetailAPIView.as_view(),
        name="dispatch-detail",
    ),
    path(
        "dispatch/<uuid:trip_id>/accept/",
        DispatchAcceptAPIView.as_view(),
        name="dispatch-accept",
    ),
    path(
        "dispatch/<uuid:trip_id>/reject/",
        DispatchRejectAPIView.as_view(),
        name="dispatch-reject",
    ),
    path(
        "dispatch/<uuid:trip_id>/arrived/",
        DispatchArrivedAPIView.as_view(),
        name="dispatch-arrived",
    ),
    path(
        "dispatch/<uuid:trip_id>/start/",
        DispatchStartAPIView.as_view(),
        name="dispatch-start",
    ),
    path(
        "dispatch/<uuid:trip_id>/complete/",
        DispatchCompleteAPIView.as_view(),
        name="dispatch-complete",
    ),
    path(
        "dispatch/<uuid:trip_id>/cancel/",
        DispatchCancelAPIView.as_view(),
        name="dispatch-cancel",
    ),

    # Broadcast Dispatch Endpoints
    path(
        "dispatch/broadcast/<uuid:request_id>/accept/",
        BroadcastAcceptAPIView.as_view(),
        name="broadcast-accept",
    ),
    path(
        "dispatch/broadcast/<uuid:request_id>/reject/",
        BroadcastRejectAPIView.as_view(),
        name="broadcast-reject",
    ),
    path(
        "dispatch/broadcast/<uuid:request_id>/cancel/",
        BroadcastCancelAPIView.as_view(),
        name="broadcast-cancel",
    ),

    # Vehicle Registration (driver self-registration)
    path(
        "vehicles/register/",
        VehicleRegistrationAPIView.as_view(),
        name="vehicle-register",
    ),

    # Admin: Driver Verification
    path(
        "admin/drivers/pending/",
        AdminPendingDriversAPIView.as_view(),
        name="admin-pending-drivers",
    ),
    path(
        "admin/drivers/<str:driver_id>/verify/",
        AdminDriverVerifyAPIView.as_view(),
        name="admin-driver-verify",
    ),
    path(
        "admin/documents/<uuid:doc_id>/verify/",
        AdminDocumentVerifyAPIView.as_view(),
        name="admin-document-verify",
    ),
    path(
        "admin/documents/<uuid:doc_id>/file/",
        AdminDocumentFileAPIView.as_view(),
        name="admin-document-file",
    ),
    path("fare-configurations/quote/", FareConfigurationQuoteAPIView.as_view(), name="fare-configuration-quote"),
    path(
        "fare-configurations/",
        FareConfigurationListCreateAPIView.as_view(),
        name="fare-configuration-list-create",
    ),
]
