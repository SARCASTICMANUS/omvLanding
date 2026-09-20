import logging
from celery import shared_task

from communication.services.rabbitmq_service import RabbitMQService
from tracking.services.location_service import LocationService

logger = logging.getLogger(__name__)


@shared_task(
    bind=True,
    max_retries=3,
    default_retry_delay=5,
    queue="tracking",
    ignore_result=True,
    acks_late=True,
    reject_on_worker_lost=True,
)
def prune_hybrid_logs(self, days=7, batch=5000):
    """
    Retention job: keep the high-write HybridLog table bounded.
    Called daily via Celery Beat; also runnable ad-hoc.
    """
    from datetime import timedelta

    from django.core.management import call_command

    try:
        call_command("prune_hybrid_logs", days=days, batch=batch)
    except Exception as exc:
        logger.error(f"Error pruning hybrid logs: {exc}")
        raise self.retry(exc=exc)


@shared_task(
    bind=True,
    max_retries=3,
    default_retry_delay=5,
    queue="tracking",
    ignore_result=True,
    acks_late=True,
    reject_on_worker_lost=True,
)
def process_location_update(self, payload):
    """
    Celery task for cold path: DB writes + snap-to-route + ETAs + broadcast.
    """
    try:
        LocationService.process_location_update(payload)
    except Exception as exc:
        logger.error(f"Error processing location update: {exc}")
        raise self.retry(exc=exc)


@shared_task(
    bind=True,
    max_retries=3,
    default_retry_delay=5,
    queue="tracking",
    ignore_result=True,
    acks_late=True,
    reject_on_worker_lost=True,
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
        from django.contrib.gis.db.models.functions import Distance
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
        stops_near = list(
            Stop.objects.filter(
                location__distance_lte=(point, D(m=2000))
            )
            .annotate(distance_m=Distance("location", point))
            .select_related("route")
            .order_by("route_id")
            .distinct("route")
        )

        broadcast_route_ids = set()
        for stop in stops_near:
            broadcast_route_ids.add(str(stop.route_id))

        # Also include routes from saved_routes
        for rid in route_ids_from_payload:
            broadcast_route_ids.add(rid)

        if not broadcast_route_ids:
            return

        # Find nearest stop for display (PostGIS geography distance → meters)
        nearest_stop_name = ""
        nearest_dist = float("inf")
        for stop in stops_near:
            d = float(stop.distance_m)
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


@shared_task(
    bind=True,
    max_retries=3,
    default_retry_delay=5,
    queue="matching",
    ignore_result=True,
    acks_late=True,
    reject_on_worker_lost=True,
)
def process_ride_request(self, payload):
    """
    Celery task that runs the matching worker.
    Filters by route → direction → proximity → sequence → ETA ranking,
    then publishes ride request to the matched driver's RabbitMQ queue.
    """
    try:
        from tracking.services.matching_service import MatchingService

        logger.info(f"Processing ride request {payload.get('request_id')} for route {payload.get('route_id')}")

        result = MatchingService.find_and_match_driver(payload)

        if result:
            logger.info(
                f"Ride request {payload.get('request_id')} matched to "
                f"vehicle {result['vehicle_id']} (ETA: {result['eta_to_pickup_s']}s)"
            )
        else:
            logger.info(f"No driver found for ride request {payload.get('request_id')}")

    except Exception as exc:
        logger.error(f"Error processing ride request: {exc}")
        raise self.retry(exc=exc)


@shared_task(
    bind=True,
    max_retries=3,
    default_retry_delay=5,
    queue="matching",
    ignore_result=True,
    acks_late=True,
    reject_on_worker_lost=True,
)
def process_ride_lifecycle(self, payload):
    """
    Celery task that handles ride lifecycle transitions:
    accept, reject, board, complete.
    """
    try:
        from tracking.services.matching_service import MatchingService

        request_id = payload.get("request_id")
        action = payload.get("action")
        user_id = payload.get("user_id")

        logger.info(f"Processing ride lifecycle: {action} for request {request_id}")

        if action == "accept":
            # Find the vehicle that accepted
            boarding = __import__("operations.models", fromlist=["BoardingRequest"]).BoardingRequest.objects.get(id=request_id)
            vehicle_id = str(boarding.trip.vehicle_id) if boarding.trip else ""
            MatchingService.accept_ride(request_id, vehicle_id)

        elif action == "reject":
            boarding = __import__("operations.models", fromlist=["BoardingRequest"]).BoardingRequest.objects.get(id=request_id)
            vehicle_id = str(boarding.trip.vehicle_id) if boarding.trip else ""
            MatchingService.reject_ride(request_id, vehicle_id)

        elif action == "board":
            MatchingService.board_passenger(request_id)

        elif action == "complete":
            MatchingService.complete_ride(request_id)

        logger.info(f"Ride lifecycle {action} completed for request {request_id}")

    except Exception as exc:
        logger.error(f"Error processing ride lifecycle: {exc}")
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


@shared_task(
    bind=True,
    max_retries=3,
    default_retry_delay=2,
    queue="tracking",
    ignore_result=True,
    acks_late=True,
    reject_on_worker_lost=True,
)
def flush_hybrid_logs(self):
    """
    Flush HybridLog entries from Redis queue to database in batch.
    Called every 5 seconds via Celery Beat.
    Reduces DB write pressure from N individual inserts to 1 bulk_create.
    """
    import json
    try:
        from django_redis import get_redis_connection
        from tracking.models import HybridLog
        from operations.models import Vehicle
        from django.contrib.gis.geos import Point

        conn = get_redis_connection("default")
        queue_key = "vayy:hybrid_log_queue"

        # Atomic: read + delete in one operation
        entries = []
        while True:
            entry = conn.rpop(queue_key)
            if entry is None:
                break
            entries.append(json.loads(entry))
            if len(entries) >= 500:
                break

        if not entries:
            return 0

        hybrid_logs = []
        for entry in entries:
            try:
                vehicle_id = entry.get("vehicle_id")
                vehicle = Vehicle.objects.get(id=vehicle_id)
                driver = vehicle.driver if hasattr(vehicle, "driver") and vehicle.driver else None
                point = Point(float(entry["lng"]), float(entry["lat"]), srid=4326)
                hybrid_logs.append(HybridLog(
                    user=driver,
                    vehicle=vehicle,
                    trip_id=entry.get("trip_id"),
                    location=point,
                    speed=entry.get("speed", 0),
                    heading=entry.get("heading", 0),
                    timestamp=entry.get("timestamp"),
                ))
            except Exception as e:
                logger.warning(f"Skipping malformed HybridLog entry: {e}")

        if hybrid_logs:
            HybridLog.objects.bulk_create(hybrid_logs, batch_size=500)

        return len(hybrid_logs)

    except Exception as exc:
        logger.error(f"Error flushing HybridLogs: {exc}")


@shared_task
def publish_geo_event(event):
    """
    Publish a geo event dict to RabbitMQ for downstream consumers.
    Fire-and-forget: swallows all exceptions with a warning log.
    """
    from communication.services.rabbitmq_service import RabbitMQService
    from common.constants import EXCHANGE_GEO, RK_GEO_EVENT

    try:
        RabbitMQService.publish(
            exchange=EXCHANGE_GEO,
            routing_key=RK_GEO_EVENT,
            payload=event,
        )
    except Exception as e:
        logger.warning(f"Failed to publish geo event: {e}")


@shared_task(
    bind=True,
    max_retries=3,
    queue="geo_events",
    acks_late=True,
    ignore_result=True,
    reject_on_worker_lost=True,
)
def consume_geo_event(self, payload):
    """
    Consumer task for geo events from RabbitMQ.
    Deserializes and persists the event.
    Retries with 30s countdown on failure.
    """
    try:
        from tracking.services.geoip_service import persist_geo_event
        persist_geo_event(payload)
    except Exception as exc:
        logger.error(f"Error consuming geo event: {exc}")
        raise self.retry(exc=exc, countdown=30)


@shared_task
def refresh_geoip_db():
    """
    Download GeoLite2-City.mmdb from MaxMind and extract to GEOIP_MMDB_PATH.
    Runs weekly via Celery Beat.
    """
    import os
    import gzip
    import shutil
    import requests
    from django.conf import settings

    GEOIP_URL = "https://cdn.jsdelivr.net/npm/geolite2-city/GeoLite2-City.mmdb.gz"
    mmdb_path = settings.GEOIP_MMDB_PATH

    try:
        os.makedirs(os.path.dirname(mmdb_path), exist_ok=True)

        resp = requests.get(GEOIP_URL, timeout=120)
        resp.raise_for_status()

        gz_path = mmdb_path + ".gz"
        with open(gz_path, "wb") as f:
            f.write(resp.content)

        with gzip.open(gz_path, "rb") as f_in, open(mmdb_path, "wb") as f_out:
            shutil.copyfileobj(f_in, f_out)

        os.remove(gz_path)
        logger.info(f"GeoIP DB refreshed successfully at {mmdb_path}")
    except Exception as e:
        logger.error(f"GeoIP DB refresh failed: {e}")
