import logging
from celery import shared_task
from django.db import transaction

from tracking.consumers.location_consumer import LocationConsumer
from tracking.consumers.gps_consumer import GPSConsumer
from communication.services.rabbitmq_service import RabbitMQService

logger = logging.getLogger(__name__)


@shared_task(
    bind=True,
    max_retries=3,
    default_retry_delay=5,
    queue="tracking"
)
def process_location_update(self, payload):
    """
    Celery task to process location updates.
    """
    try:
        LocationConsumer.handle_location_update(payload)
    except Exception as exc:
        logger.error(f"Error processing location update: {exc}")
        raise self.retry(exc=exc)


@shared_task(
    bind=True,
    max_retries=3,
    default_retry_delay=5,
    queue="tracking"
)
def process_gps_raw(self, payload):
    """
    Celery task to process raw GPS ingestion.
    """
    try:
        GPSConsumer.handle_gps_raw(payload)
    except Exception as exc:
        logger.error(f"Error processing raw GPS: {exc}")
        raise self.retry(exc=exc)


@shared_task(
    bind=True,
    max_retries=3,
    default_retry_delay=5,
    queue="tracking"
)
def process_passenger_location(self, payload):
    """
    Celery task to process passenger location updates.
    Broadcasts passenger location to all route WS groups the passenger is near.
    """
    try:
        from asgiref.sync import async_to_sync
        from channels.layers import get_channel_layer
        from django.contrib.gis.geos import Point
        from django.contrib.gis.measure import D
        from transport.models import Stop

        user_id = payload.get("user_id")
        lat = payload.get("lat")
        lng = payload.get("lng")
        display_name = payload.get("display_name", "Passenger")
        route_ids_from_payload = payload.get("route_ids", [])

        if not user_id or lat is None or lng is None:
            logger.error(f"Invalid passenger location payload: {payload}")
            return

        point = Point(float(lng), float(lat), srid=4326)
        channel_layer = get_channel_layer()

        # Find routes this passenger is near by checking stops within 2km
        stops_near = Stop.objects.filter(
            location__distance_lte=(point, D(m=2000))
        ).select_related("route").order_by("route_id").distinct("route")

        broadcast_route_ids = set()
        for stop in stops_near:
            broadcast_route_ids.add(str(stop.route_id))

        # Also include routes from saved_routes
        for rid in route_ids_from_payload:
            broadcast_route_ids.add(rid)

        if not broadcast_route_ids:
            return

        # Find nearest stop for display
        nearest_stop_name = ""
        nearest_dist = float("inf")
        for stop in stops_near:
            d = point.distance(stop.location) * 111000
            if d < nearest_dist:
                nearest_dist = d
                nearest_stop_name = stop.name

        ws_payload = {
            "type": "passenger_update",
            "data": {
                "type": "passenger_location",
                "event": "passenger_location",
                "user_id": user_id,
                "lat": float(lat),
                "lng": float(lng),
                "display_name": display_name,
                "near_stop": nearest_stop_name,
                "distance_to_stop_m": round(nearest_dist),
            }
        }

        for route_id in broadcast_route_ids:
            async_to_sync(channel_layer.group_send)(
                f"route_passengers_{route_id}",
                ws_payload,
            )

        logger.debug(f"Broadcast passenger {user_id} to {len(broadcast_route_ids)} route groups")

    except Exception as exc:
        logger.error(f"Error processing passenger location: {exc}")
        raise self.retry(exc=exc)


@shared_task
def sync_rabbitmq_infrastructure():
    """
    Task to ensure RabbitMQ exchanges and queues are correctly setup.
    """
    try:
        RabbitMQService.setup_infrastructure()
        return "RabbitMQ setup completed"
    except Exception as e:
        logger.error(f"RabbitMQ setup failed: {e}")
        return f"RabbitMQ setup failed: {str(e)}"
