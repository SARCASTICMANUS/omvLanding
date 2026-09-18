import logging
from datetime import timedelta
from django.utils import timezone
from celery import shared_task
from common.constants import ROLE_PASSENGER, ROLE_BIKE_DRIVER, ROLE_AUTO_DRIVER, TRIP_STATUS_COMPLETED

logger = logging.getLogger(__name__)


@shared_task(bind=True, max_retries=3)
def create_daily_kpi_snapshot(self):
    """Aggregate yesterday's metrics into a KPISnapshot row."""
    from accounts.models import User
    from transport.models import City, Route, Stop
    from operations.models import ActiveTrip
    from kpi.models import PageView, KPISnapshot

    today = timezone.now().date()
    yesterday = today - timedelta(days=1)

    total_users = User.objects.count()
    total_passengers = User.objects.filter(role=ROLE_PASSENGER).count()
    total_drivers = User.objects.filter(role__in=[ROLE_BIKE_DRIVER, ROLE_AUTO_DRIVER]).count()
    total_cities = City.objects.count()
    total_routes = Route.objects.count()
    total_stops = Stop.objects.count()
    total_trips = ActiveTrip.objects.filter(status=TRIP_STATUS_COMPLETED).count()

    web_visits = PageView.objects.filter(
        platform="web", created_at__date=yesterday
    ).count()
    app_visits = PageView.objects.filter(
        platform="app", created_at__date=yesterday
    ).count()

    snapshot, created = KPISnapshot.objects.update_or_create(
        date=yesterday,
        defaults={
            "total_users": total_users,
            "total_passengers": total_passengers,
            "total_drivers": total_drivers,
            "total_routes": total_routes,
            "total_stops": total_stops,
            "total_trips": total_trips,
            "total_cities": total_cities,
            "web_visits": web_visits,
            "app_visits": app_visits,
        },
    )

    action = "Created" if created else "Updated"
    logger.info(f"{action} KPI snapshot for {yesterday}: {total_users} users, {total_trips} trips")
    return {"date": str(yesterday), "created": created}
