from operations.models import (
    BoardingRequest,
)

from common.constants import (
    BOARDING_PENDING,
)


class BoardingSelector:
    """
    Read-only Boarding queries.
    """

    @staticmethod
    def get_request(
        request_id,
    ):
        return (
            BoardingRequest.objects
            .select_related(
                "passenger",
                "trip",
                "pickup_stop",
            )
            .get(
                id=request_id
            )
        )

    @staticmethod
    def list_trip_requests(
        trip_id,
    ):
        return (
            BoardingRequest.objects
            .select_related(
                "passenger",
                "pickup_stop",
            )
            .filter(
                trip_id=trip_id
            )
            .order_by(
                "-created_at"
            )
        )

    @staticmethod
    def list_passenger_requests(
        passenger_id,
    ):
        return (
            BoardingRequest.objects
            .select_related(
                "trip",
                "pickup_stop",
            )
            .filter(
                passenger_id=passenger_id
            )
            .order_by(
                "-created_at"
            )
        )

    @staticmethod
    def get_pending_request(
        passenger_id,
        trip_id,
    ):
        return (
            BoardingRequest.objects
            .select_related(
                "pickup_stop",
            )
            .filter(
                passenger_id=passenger_id,
                trip_id=trip_id,
                status=BOARDING_PENDING,
            )
            .first()
        )

    @staticmethod
    def list_pending_trip_requests(
        trip_id,
    ):
        return (
            BoardingRequest.objects
            .select_related(
                "passenger",
                "pickup_stop",
            )
            .filter(
                trip_id=trip_id,
                status=BOARDING_PENDING,
            )
            .order_by(
                "created_at"
            )
        )

    @staticmethod
    def count_trip_requests(
        trip_id,
    ):
        return (
            BoardingRequest.objects
            .filter(
                trip_id=trip_id
            )
            .count()
        )