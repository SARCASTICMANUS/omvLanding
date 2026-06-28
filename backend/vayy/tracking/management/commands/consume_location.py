import json
import logging
import pika
from django.core.management.base import BaseCommand
from django.conf import settings
from tracking.tasks import process_location_update, process_passenger_location
from communication.services.rabbitmq_service import RabbitMQService
from communication.constants import (
    QUEUE_LOCATION_AUTO, QUEUE_LOCATION_BIKE, QUEUE_LOCATION_PASSENGER,
)

logger = logging.getLogger(__name__)


def callback(ch, method, properties, body):
    try:
        payload = json.loads(body)
        queue_name = method.routing_key
        logger.info(f"RabbitMQ received vehicle location: vehicle={payload.get('vehicle_id')} queue={queue_name}")
        process_location_update.delay(payload)
        ch.basic_ack(delivery_tag=method.delivery_tag)
    except Exception as e:
        logger.exception(f"Failed to process location message: {e}")
        ch.basic_nack(delivery_tag=method.delivery_tag, requeue=False)


def passenger_callback(ch, method, properties, body):
    try:
        payload = json.loads(body)
        logger.info(f"RabbitMQ received passenger location: user={payload.get('user_id')}")
        process_passenger_location.delay(payload)
        ch.basic_ack(delivery_tag=method.delivery_tag)
    except Exception as e:
        logger.exception(f"Failed to process passenger location message: {e}")
        ch.basic_nack(delivery_tag=method.delivery_tag, requeue=False)


class Command(BaseCommand):
    help = "Consume location updates from RabbitMQ and dispatch to Celery"

    def handle(self, *args, **options):
        self.stdout.write("Starting RabbitMQ location consumer...")

        # Ensure RabbitMQ exchanges/queues exist before consuming
        try:
            RabbitMQService.setup_infrastructure()
            self.stdout.write("RabbitMQ infrastructure synced.")
        except Exception as e:
            self.stdout.write(f"Warning: could not setup RabbitMQ infra: {e}")

        # Retry connection to RabbitMQ (it may not be ready yet)
        connection = None
        for attempt in range(10):
            try:
                parameters = pika.URLParameters(settings.RABBITMQ_URL)
                connection = pika.BlockingConnection(parameters)
                break
            except pika.exceptions.AMQPConnectionError:
                self.stdout.write(f"RabbitMQ not ready, retrying in 5s... (attempt {attempt + 1}/10)")
                import time
                time.sleep(5)
        
        if connection is None:
            self.stdout.write(self.style.ERROR("Failed to connect to RabbitMQ after 10 attempts"))
            return

        channel = connection.channel()

        # Set prefetch so we don't overwhelm the Celery worker
        channel.basic_qos(prefetch_count=10)

        # Vehicle location queues
        vehicle_queues = [QUEUE_LOCATION_AUTO, QUEUE_LOCATION_BIKE]
        for queue in vehicle_queues:
            channel.basic_consume(queue=queue, on_message_callback=callback, auto_ack=False)
            self.stdout.write(f"Listening on queue: {queue}")

        # Passenger location queue
        channel.basic_consume(queue=QUEUE_LOCATION_PASSENGER, on_message_callback=passenger_callback, auto_ack=False)
        self.stdout.write(f"Listening on queue: {QUEUE_LOCATION_PASSENGER}")

        self.stdout.write("Waiting for location messages. To exit press CTRL+C")
        try:
            channel.start_consuming()
        except KeyboardInterrupt:
            channel.stop_consuming()
        connection.close()
