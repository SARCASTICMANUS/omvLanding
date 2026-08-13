import logging
from django.db import transaction
from django.db.models import Avg

from accounts.models import User, PublicDriverProfile
from operations.models import ActiveTrip, TripRating

logger = logging.getLogger(__name__)


class RatingService:
    """
    Handles trip ratings and automatic update of driver statistics.
    """

    @staticmethod
    @transaction.atomic
    def rate_trip(trip_id: str, passenger: User, rating: int, review: str = "") -> TripRating:
        """
        Submits a rating for a completed trip and updates driver stats.
        """
        trip = ActiveTrip.objects.get(id=trip_id)
        
        if trip.status != "completed":
            raise ValueError("Only completed trips can be rated")

        if hasattr(trip, "rating_record"): # Check if already rated
             raise ValueError("Trip has already been rated")

        # Create rating
        trip_rating = TripRating.objects.create(
            trip=trip,
            passenger=passenger,
            driver=trip.driver,
            rating=rating,
            review=review
        )

        # Update Driver Statistics
        RatingService.update_driver_stats(trip.driver)

        logger.info(f"Trip {trip_id} rated {rating}/5 by passenger {passenger.id}")
        return trip_rating

    @staticmethod
    def update_driver_stats(driver: User):
        """
        Recalculates average rating and total trips for a driver.
        """
        profile = driver.driver_profile
        
        stats = TripRating.objects.filter(driver=driver).aggregate(
            avg_rating=Avg("rating")
        )

        profile.rating = round(stats["avg_rating"] or 5.0, 2)
        profile.save(update_fields=["rating"])

        logger.info(f"Updated stats for driver {driver.id}. New average rating: {profile.rating}")
