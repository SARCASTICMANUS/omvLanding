import json
import logging
import pika
import uuid
from typing import Any, Dict, Optional

from django.conf import settings
from common.middleware import get_correlation_id

logger = logging.getLogger(__name__)


class RabbitMQService:
    _connection = None
    _channel = None

    @classmethod
    def get_channel(cls):
        """
        Get or create a RabbitMQ channel with publisher confirms enabled.
        """
        if cls._channel is None or cls._channel.is_closed or cls._connection is None or cls._connection.is_closed:
            try:
                parameters = pika.URLParameters(settings.RABBITMQ_URL)
                cls._connection = pika.BlockingConnection(parameters)
                cls._channel = cls._connection.channel()
                cls._channel.confirm_delivery()
                logger.info("Connected to RabbitMQ and enabled publisher confirms")
            except pika.exceptions.AMQPError as e:
                logger.error(f"Failed to connect to RabbitMQ: {e}")
                raise
        return cls._channel

    @classmethod
    def publish(
        cls,
        exchange: str,
        routing_key: str,
        payload: Dict[str, Any],
        correlation_id: Optional[str] = None,
        headers: Optional[Dict[str, Any]] = None,
    ):
        """
        Publish a message to RabbitMQ with confirms and persistence.
        """
        try:
            channel = cls.get_channel()

            # Auto-inject correlation ID from middleware if available
            corr_id = correlation_id or get_correlation_id() or str(uuid.uuid4())

            properties = pika.BasicProperties(
                delivery_mode=2,  # make message persistent
                content_type='application/json',
                correlation_id=corr_id,
                headers=headers or {}
            )

            success = channel.basic_publish(
                exchange=exchange,
                routing_key=routing_key,
                body=json.dumps(payload),
                properties=properties
            )

            # basic_publish returns None when publisher confirms are enabled;
            # wait for the broker confirmation instead of checking the return value.
            try:
                channel.wait_for_confirms(timeout=5)
                logger.debug(f"Successfully published message to {exchange} with key {routing_key}")
            except Exception:
                logger.warning(f"Publisher confirm timed out for {exchange} {routing_key}, message may still be delivered")

        except (pika.exceptions.AMQPError, pika.exceptions.StreamLostError, ConnectionError, OSError) as e:
            logger.warning(
                "RabbitMQ publish failed (will reconnect): %s %s — %s",
                exchange,
                routing_key,
                e,
            )
            # Reset connection on failure to force reconnect next time
            cls._connection = None
            cls._channel = None

    @classmethod
    def setup_infrastructure(cls):
        """
        Setup exchanges, queues and DLQs as per vayy_correct.xml
        """
        from common.constants import (
            EXCHANGE_LOCATION, EXCHANGE_DISPATCH, EXCHANGE_NOTIFICATION,
            EXCHANGE_BOARDING, EXCHANGE_TRIP, EXCHANGE_MATCHING, EXCHANGE_GEO,
            QUEUE_LOCATION_AUTO, QUEUE_LOCATION_BIKE, QUEUE_LOCATION_PASSENGER,
            QUEUE_DISPATCH_ASSIGNMENT,
            QUEUE_NOTIFICATION_EVENTS, QUEUE_BOARDING,
            QUEUE_TRIP_EVENTS, QUEUE_MATCHING,
            QUEUE_DLX, QUEUE_DEAD_LETTER,
            QUEUE_GEO_EVENTS,
            RK_LOCATION_AUTO, RK_LOCATION_BIKE, RK_LOCATION_PASSENGER, RK_DISPATCH_ASSIGN,
            RK_NOTIFICATION_ANY, RK_BOARDING_ANY,
            RK_TRIP_ANY, RK_MATCHING_ANY,
            RK_GEO_EVENT,
        )

        try:
            channel = cls.get_channel()

            # Declare DLX and DLQ
            channel.exchange_declare(exchange=QUEUE_DLX, exchange_type='direct', durable=True)
            channel.queue_declare(queue=QUEUE_DEAD_LETTER, durable=True)
            channel.queue_bind(exchange=QUEUE_DLX, queue=QUEUE_DEAD_LETTER, routing_key='dead.letter')

            # Helper for declaring durable queues with DLX
            def declare_vayy_queue(name, exchange, routing_key):
                channel.queue_declare(
                    queue=name,
                    durable=True,
                    arguments={
                        'x-dead-letter-exchange': QUEUE_DLX,
                        'x-dead-letter-routing-key': 'dead.letter'
                    }
                )
                channel.queue_bind(exchange=exchange, queue=name, routing_key=routing_key)

            # Location queues also bind with wildcard so location.gps flows through
            def declare_location_queue(name, exchange, routing_key):
                channel.queue_declare(
                    queue=name,
                    durable=True,
                    arguments={
                        'x-dead-letter-exchange': QUEUE_DLX,
                        'x-dead-letter-routing-key': 'dead.letter'
                    }
                )
                channel.queue_bind(exchange=exchange, queue=name, routing_key=routing_key)
                channel.queue_bind(exchange=exchange, queue=name, routing_key="location.*")

            # Declare Exchanges
            channel.exchange_declare(exchange=EXCHANGE_LOCATION, exchange_type='topic', durable=True)
            channel.exchange_declare(exchange=EXCHANGE_DISPATCH, exchange_type='direct', durable=True)
            channel.exchange_declare(exchange=EXCHANGE_NOTIFICATION, exchange_type='topic', durable=True)
            channel.exchange_declare(exchange=EXCHANGE_BOARDING, exchange_type='topic', durable=True)
            channel.exchange_declare(exchange=EXCHANGE_TRIP, exchange_type='topic', durable=True)
            channel.exchange_declare(exchange=EXCHANGE_MATCHING, exchange_type='topic', durable=True)
            channel.exchange_declare(exchange=EXCHANGE_GEO, exchange_type='direct', durable=True)

            # Declare and Bind Queues
            declare_location_queue(QUEUE_LOCATION_AUTO, EXCHANGE_LOCATION, RK_LOCATION_AUTO)
            declare_location_queue(QUEUE_LOCATION_BIKE, EXCHANGE_LOCATION, RK_LOCATION_BIKE)
            declare_location_queue(QUEUE_LOCATION_PASSENGER, EXCHANGE_LOCATION, RK_LOCATION_PASSENGER)
            declare_vayy_queue(QUEUE_DISPATCH_ASSIGNMENT, EXCHANGE_DISPATCH, RK_DISPATCH_ASSIGN)
            declare_vayy_queue(QUEUE_NOTIFICATION_EVENTS, EXCHANGE_NOTIFICATION, RK_NOTIFICATION_ANY)
            declare_vayy_queue(QUEUE_BOARDING, EXCHANGE_BOARDING, RK_BOARDING_ANY)
            declare_vayy_queue(QUEUE_TRIP_EVENTS, EXCHANGE_TRIP, RK_TRIP_ANY)
            declare_vayy_queue(QUEUE_MATCHING, EXCHANGE_MATCHING, RK_MATCHING_ANY)

            channel.queue_declare(
                queue=QUEUE_GEO_EVENTS,
                durable=True,
                arguments={
                    'x-dead-letter-exchange': QUEUE_DLX,
                    'x-dead-letter-routing-key': 'dead.letter',
                },
            )
            channel.queue_bind(exchange=EXCHANGE_GEO, queue=QUEUE_GEO_EVENTS, routing_key=RK_GEO_EVENT)

            logger.info("RabbitMQ infrastructure setup completed successfully")

        except pika.exceptions.AMQPError:
            logger.exception("Failed to setup RabbitMQ infrastructure")
            raise
