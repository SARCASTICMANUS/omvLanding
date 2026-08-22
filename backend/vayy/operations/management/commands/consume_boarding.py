import json
import logging
import pika
from django.core.management.base import BaseCommand
from django.conf import settings
from communication.services.rabbitmq_service import RabbitMQService
from communication.constants import QUEUE_BOARDING

logger = logging.getLogger(__name__)


def boarding_callback(ch, method, properties, body):
    """
    Handle boarding events from RabbitMQ.
    ACK on success, NACK on failure (no requeue — these are fire-and-forget notifications).
    """
    try:
        payload = json.loads(body)
        routing_key = method.routing_key
        logger.info(f"RabbitMQ boarding event: key={routing_key} payload={payload}")

        from operations.tasks import process_boarding_event
        process_boarding_event.delay(payload)
        ch.basic_ack(delivery_tag=method.delivery_tag)
    except Exception as e:
        logger.exception(f"Failed to process boarding message: {e}")
        ch.basic_nack(delivery_tag=method.delivery_tag, requeue=False)


class Command(BaseCommand):
    help = "Consume boarding events from RabbitMQ and dispatch to Celery"

    def handle(self, *args, **options):
        self.stdout.write("Starting RabbitMQ boarding consumer...")

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

        # Consume boarding events queue
        channel.basic_consume(
            queue=QUEUE_BOARDING,
            on_message_callback=boarding_callback,
            auto_ack=False,
        )
        self.stdout.write(f"Listening on queue: {QUEUE_BOARDING}")

        self.stdout.write("Waiting for boarding messages. To exit press CTRL+C")
        try:
            channel.start_consuming()
        except KeyboardInterrupt:
            channel.stop_consuming()
        connection.close()
