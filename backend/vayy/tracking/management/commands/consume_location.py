import json
import signal
import logging
import sys

import pika
from django.core.management.base import BaseCommand
from django.conf import settings

from communication.services.rabbitmq_service import RabbitMQService
from tracking.tasks import process_location_update

logger = logging.getLogger(__name__)

QUEUES = ["auto.location", "bike.location", "passenger.location"]


class Command(BaseCommand):
    help = "Consume location updates from RabbitMQ and dispatch Celery tasks"

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self._running = True
        signal.signal(signal.SIGINT, self._stop)
        signal.signal(signal.SIGTERM, self._stop)

    def _stop(self, signum, frame):
        self._running = False
        self.stdout.write("Shutting down location consumer...")

    def handle(self, *args, **options):
        self.stdout.write("Starting location consumer...")

        try:
            RabbitMQService.setup_infrastructure()
        except Exception as e:
            self.stderr.write(f"RabbitMQ setup failed: {e}")
            sys.exit(1)

        connection = None
        try:
            parameters = pika.URLParameters(settings.RABBITMQ_URL)
            connection = pika.BlockingConnection(parameters)
            channel = connection.channel()
            channel.basic_qos(prefetch_count=10)

            for queue in QUEUES:
                channel.queue_declare(
                    queue=queue,
                    durable=True,
                    arguments={
                        'x-dead-letter-exchange': 'vayy.dlx',
                        'x-dead-letter-routing-key': 'dead.letter'
                    }
                )
                channel.basic_consume(
                    queue=queue,
                    on_message_callback=self._callback,
                )
                self.stdout.write(f"Listening on queue: {queue}")

            self.stdout.write("Location consumer is running. Press Ctrl+C to stop.")
            while self._running:
                connection.process_data_events(time_limit=1)

        except KeyboardInterrupt:
            self.stdout.write("Received interrupt, shutting down...")
        except Exception as e:
            self.stderr.write(f"Consumer error: {e}")
            raise
        finally:
            if connection and not connection.is_closed:
                connection.close()
            self.stdout.write("Location consumer stopped.")

    def _callback(self, ch, method, properties, body):
        try:
            payload = json.loads(body)
            vehicle_id = payload.get("vehicle_id")
            if not vehicle_id:
                logger.warning("Received location message without vehicle_id, skipping")
                ch.basic_ack(delivery_tag=method.delivery_tag)
                return

            process_location_update.delay(payload)
            ch.basic_ack(delivery_tag=method.delivery_tag)

            logger.debug(
                f"Dispatched location update for vehicle {vehicle_id} "
                f"from queue {method.routing_key}"
            )
        except json.JSONDecodeError:
            logger.error(f"Invalid JSON in location message: {body}")
            ch.basic_nack(delivery_tag=method.delivery_tag, requeue=False)
        except Exception as e:
            logger.exception(f"Failed to process location message: {e}")
            ch.basic_nack(delivery_tag=method.delivery_tag, requeue=True)
