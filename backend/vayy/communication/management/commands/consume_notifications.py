import json
import logging
import time

import pika
from django.conf import settings
from django.core.management.base import BaseCommand

from communication.services.rabbitmq_service import RabbitMQService
from common.constants import QUEUE_NOTIFICATION_EVENTS

logger = logging.getLogger(__name__)


def notification_callback(ch, method, properties, body):
    """
    Bridge a notification event from RabbitMQ into Celery.

    This is the only caller of send_notification.delay(). NotificationService.create
    publishes the event and deliberately does NOT call the task itself: doing both
    would deliver every notification twice, since the row-level idempotency check
    in NotificationConsumer is a read-then-write race, not a lock.

    ACK once the task is enqueued. Celery owns delivery from here, so a provider
    outage is retried by send_notification's backoff rather than by redelivering
    on the broker.
    """
    try:
        payload = json.loads(body)
        logger.info(
            "RabbitMQ notification event: key=%s payload=%s",
            method.routing_key, payload,
        )

        from communication.tasks import send_notification
        send_notification.delay(payload)
        ch.basic_ack(delivery_tag=method.delivery_tag)

    except json.JSONDecodeError:
        # Unparseable: dead-letter it, never requeue.
        logger.error("Invalid JSON in notification event: %s", body[:500])
        ch.basic_nack(delivery_tag=method.delivery_tag, requeue=False)
    except Exception as exc:
        # A message that fails the same way twice is poison, not transient.
        # Requeueing forever would block every later notification behind it.
        if method.redelivered:
            logger.exception(
                "Notification event failed again after requeue, dead-lettering "
                "(routing_key=%s): %s",
                method.routing_key, exc,
            )
            ch.basic_nack(delivery_tag=method.delivery_tag, requeue=False)
        else:
            logger.warning(
                "Failed to enqueue notification, requeueing once "
                "(routing_key=%s): %s",
                method.routing_key, exc,
            )
            ch.basic_nack(delivery_tag=method.delivery_tag, requeue=True)


class Command(BaseCommand):
    help = "Consume notification events from RabbitMQ and dispatch delivery to Celery"

    def handle(self, *args, **options):
        self.stdout.write("Starting RabbitMQ notification consumer...")

        try:
            RabbitMQService.setup_infrastructure()
            self.stdout.write("RabbitMQ infrastructure synced.")
        except Exception as e:
            self.stdout.write(f"Warning: could not setup RabbitMQ infra: {e}")

        connection = None
        for attempt in range(10):
            try:
                parameters = pika.URLParameters(settings.RABBITMQ_URL)
                connection = pika.BlockingConnection(parameters)
                break
            except pika.exceptions.AMQPConnectionError:
                self.stdout.write(
                    f"RabbitMQ not ready, retrying in 5s... (attempt {attempt + 1}/10)"
                )
                time.sleep(5)

        if connection is None:
            self.stdout.write(
                self.style.ERROR("Failed to connect to RabbitMQ after 10 attempts")
            )
            return

        channel = connection.channel()
        channel.basic_qos(prefetch_count=10)

        channel.basic_consume(
            queue=QUEUE_NOTIFICATION_EVENTS,
            on_message_callback=notification_callback,
            auto_ack=False,
        )
        self.stdout.write(f"Listening on queue: {QUEUE_NOTIFICATION_EVENTS}")
        self.stdout.write("Waiting for notification messages. To exit press CTRL+C")

        try:
            channel.start_consuming()
        except KeyboardInterrupt:
            channel.stop_consuming()
        connection.close()
