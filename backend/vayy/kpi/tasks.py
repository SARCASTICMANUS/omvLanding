import logging
from datetime import timedelta
from typing import Any

from celery import shared_task
from django.utils import timezone

from common.constants import (
    ROLE_PASSENGER,
    ROLE_BIKE_DRIVER,
    ROLE_AUTO_DRIVER,
    TRIP_STATUS_COMPLETED,
)

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
    total_drivers = User.objects.filter(
        role__in=[ROLE_BIKE_DRIVER, ROLE_AUTO_DRIVER]
    ).count()
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
    logger.info(
        f"{action} KPI snapshot for {yesterday}: {total_users} users, {total_trips} trips"
    )
    return {"date": str(yesterday), "created": created}


@shared_task(
    bind=True,
    max_retries=3,
    default_retry_delay=2,
    queue="celery",
    ignore_result=True,
    acks_late=True,
    reject_on_worker_lost=True,
)
def process_pageview_event(self, event_payload: dict[str, Any]) -> None:
    """Consume a single pageview event from RabbitMQ and write to PostgreSQL.

    Each pageview fires one Celery task. RabbitMQ handles queueing and
    delivery guarantees. At admin SPA traffic levels this is lightweight
    and avoids the complexity of custom batching logic.
    """
    try:
        from kpi.models import PageView

        ip_address = event_payload.get("ip_address") or None

        PageView.objects.create(
            platform=event_payload["platform"],
            page=event_payload["page"],
            visitor_id=event_payload.get("visitor_id", ""),
            ip_address=ip_address,
            user_agent=event_payload.get("user_agent", ""),
            referrer=event_payload.get("referrer", ""),
            country=event_payload.get("country", ""),
            city=event_payload.get("city", ""),
            region=event_payload.get("region", ""),
            country_code=event_payload.get("country_code", ""),
            latitude=event_payload.get("latitude"),
            longitude=event_payload.get("longitude"),
            timezone=event_payload.get("timezone", ""),
            device_type=event_payload.get("device_type", ""),
        )
    except Exception as exc:
        logger.error(f"Failed to write PageView event: {exc}", exc_info=True)
        raise self.retry(exc=exc)


@shared_task(bind=True, max_retries=2, ignore_result=True)
def refresh_materialized_views(self) -> None:
    """Refresh all materialized views concurrently.

    Runs every 6 hours via Celery Beat. Uses CONCURRENTLY to avoid
    locking the view during reads.
    """
    from django.db import connection

    views = ["mv_daily_page_stats"]

    with connection.cursor() as cursor:
        for view_name in views:
            try:
                cursor.execute(
                    f"REFRESH MATERIALIZED VIEW CONCURRENTLY {view_name}"
                )
                logger.info(f"Refreshed materialized view: {view_name}")
            except Exception as exc:
                logger.error(f"Failed to refresh {view_name}: {exc}")
