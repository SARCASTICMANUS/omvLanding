import json
import logging
import pika
import uuid
from collections import Counter
from typing import Any, Dict, Optional

from django.conf import settings
from common.middleware import get_correlation_id

logger = logging.getLogger(__name__)

# Length cap per queue. Most of these queues intentionally have no AMQP
# consumer: the authoritative business processing runs through Celery (see the
# DispatchConsumer/NotificationConsumer docstrings). Without a cap such a queue
# grows until the broker's disk is full, because nothing ever drains it.
# drop-head keeps the newest messages (the useful ones for a live tail) and
# bounds memory instead of refusing publishes.
QUEUE_MAX_LENGTH = {
    "auto.location": 50_000,
    "bike.location": 50_000,
    "passenger.location": 50_000,
    "dispatch.assignment": 10_000,
    "dispatch.events": 10_000,
    "dispatch.pushes": 10_000,
    "notification.events": 10_000,
    "boarding.requests": 10_000,
    "trip.events": 10_000,
    "matching.ride_requests": 10_000,
    "geo_events": 50_000,
    "dead.letter": 5_000,
}

# Event-stream messages are only useful while recent. The TTL means a queue that
# nobody drains does not sit on stale messages indefinitely.
QUEUE_MESSAGE_TTL_MS = 24 * 60 * 60 * 1000


class RabbitMQService:
    _connection = None
    _channel = None

    # "exchange:routing_key" -> count of publishes the broker returned as
    # unroutable. Exposed so the condition is countable and not only logged.
    _unroutable = Counter()

    @classmethod
    def unroutable_publishes(cls) -> Dict[str, int]:
        return dict(cls._unroutable)

    @classmethod
    def _on_return(cls, channel, method, properties, body):
        """
        basic.return callback.

        Fires when the broker accepted a message but no queue is bound for its
        routing key, so the message is being discarded. This is the only signal
        that a publish vanished: without mandatory=True the broker drops these
        silently, which is what makes a broken binding look exactly like a
        healthy one.
        """
        key = f"{method.exchange}:{method.routing_key}"
        cls._unroutable[key] += 1
        logger.error(
            "RabbitMQ returned an UNROUTABLE message and discarded it "
            "(exchange=%s routing_key=%s total=%d). No queue is bound for this "
            "key: either the binding is missing or the publisher is using the "
            "wrong key shape.",
            method.exchange,
            method.routing_key,
            cls._unroutable[key],
        )

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
                # Re-registered on every (re)connect: a fresh channel carries no
                # return listener, so without this a reconnect would silently
                # disable unroutable-message reporting.
                cls._channel.add_on_return_callback(cls._on_return)
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

            channel.basic_publish(
                exchange=exchange,
                routing_key=routing_key,
                body=json.dumps(payload),
                properties=properties,
                # Without mandatory=True the broker silently discards a message
                # whose routing key matches no binding, and the publisher has no
                # way to tell. With it, the broker returns the message and
                # _on_return logs it.
                mandatory=True,
            )

            # basic_publish returns None when publisher confirms are enabled;
            # wait for the broker confirmation instead of checking the return value.
            try:
                if not channel.wait_for_confirms(timeout=5):
                    logger.warning(
                        "Broker did not confirm publish %s %s; message was not accepted",
                        exchange, routing_key,
                    )
                else:
                    logger.debug(f"Successfully published message to {exchange} with key {routing_key}")
            except Exception:
                logger.warning(f"Publisher confirm timed out for {exchange} {routing_key}, message may still be delivered")

            # basic.return frames are dispatched by the I/O loop, not by
            # basic_publish, so pump it to make _on_return fire (and log) before
            # this call returns.
            try:
                channel.process_data_events(time_limit=0)
            except Exception as e:
                logger.debug(f"Could not pump returned messages: {e}")

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
    def declare_queue(cls, channel, name, arguments=None):
        """
        Declare one bounded queue on a caller-supplied channel.

        Public entry point for anything outside setup_infrastructure that needs
        a queue declared on its *own* connection - notably the consume_location
        management command, which consumes these queues over a separate
        connection from the one setup_infrastructure declared them on.

        Such a consumer must not call ``channel.queue_declare`` itself. RabbitMQ
        compares arguments on every redeclare, so omitting the length/TTL caps
        that this build applies is refused with
        ``PRECONDITION_FAILED ... inequivalent arg 'x-message-ttl'`` (406), which
        also closes the channel. Routing through the same helper makes the two
        declarations identical by construction instead of by convention.

        Returns True when the queue is declared and usable, False when the
        broker refused it (the channel is then closed and unusable).
        """
        return cls._declare_bounded_queue(channel, name, arguments)

    @classmethod
    def _declare_bounded_queue(cls, channel, name, arguments=None):
        """
        Declare a durable queue with a length cap, drop-head overflow and a TTL.

        OPERATIONAL NOTE for an existing broker: RabbitMQ refuses to redeclare a
        durable queue with different arguments (PRECONDITION_FAILED, inequivalent
        arg). The queues below were originally declared without these caps, so a
        broker that already has them needs a one-time recreate. It is safe here
        because none of them hold state a consumer still needs:

            rabbitmqctl delete_queue dispatch.assignment
            rabbitmqctl delete_queue dispatch.events
            rabbitmqctl delete_queue dispatch.pushes
            rabbitmqctl delete_queue notification.events
            rabbitmqctl delete_queue trip.events
            rabbitmqctl delete_queue matching.ride_requests
            rabbitmqctl delete_queue geo_events
            rabbitmqctl delete_queue auto.location
            rabbitmqctl delete_queue bike.location
            rabbitmqctl delete_queue passenger.location
            rabbitmqctl delete_queue dead.letter

        The precondition failure is caught and logged rather than raised, so a
        consumer process does not crash-loop on startup while the operator has
        not yet run the recreate.
        """
        args = {
            'x-max-length': QUEUE_MAX_LENGTH.get(name, 10_000),
            'x-overflow': 'drop-head',
            'x-message-ttl': QUEUE_MESSAGE_TTL_MS,
        }
        if arguments:
            args.update(arguments)
        try:
            channel.queue_declare(queue=name, durable=True, arguments=args)
            return True
        except pika.exceptions.ChannelClosedByBroker as e:
            if 'PRECONDITION' in str(e):
                logger.error(
                    "Queue %r already exists without the length/TTL caps this "
                    "build declares, so it can still grow unbounded. Recreate it "
                    "once - see _declare_bounded_queue for the command list. (%s)",
                    name, e,
                )
                # The channel is closed by the broker after a precondition
                # failure, so hand back a usable one for the remaining declares.
                return False
            raise

    @classmethod
    def setup_infrastructure(cls):
        """
        Setup exchanges, queues and DLQs.

        Posture: Celery is the authoritative processing path for business
        events. These queues are a bounded, observable event stream - they exist
        so dispatch/notification/trip/matching traffic is inspectable rather than
        silently vanishing, and so the boarding pipeline (the one real AMQP
        consumer, consume_boarding) keeps working.

        They are deliberately NOT wired to AMQP consumers that would re-run
        business logic already executed from Celery by DispatchConsumer and
        NotificationConsumer; doing so would process every event twice. That
        also satisfies the "do not remove RabbitMQ exchanges or queues" rule:
        the topology stays declared and bounded, Celery stays the processor.
        """
        from common.constants import (
            EXCHANGE_LOCATION, EXCHANGE_DISPATCH, EXCHANGE_NOTIFICATION,
            EXCHANGE_BOARDING, EXCHANGE_TRIP, EXCHANGE_MATCHING, EXCHANGE_GEO,
            QUEUE_LOCATION_AUTO, QUEUE_LOCATION_BIKE, QUEUE_LOCATION_PASSENGER,
            QUEUE_DISPATCH_ASSIGNMENT, QUEUE_DISPATCH_EVENTS, QUEUE_DISPATCH_PUSH,
            QUEUE_NOTIFICATION_EVENTS, QUEUE_BOARDING,
            QUEUE_TRIP_EVENTS, QUEUE_MATCHING,
            QUEUE_DLX, QUEUE_DEAD_LETTER,
            QUEUE_GEO_EVENTS,
            RK_LOCATION_AUTO, RK_LOCATION_BIKE, RK_LOCATION_PASSENGER, RK_DISPATCH_ASSIGN,
            RK_DISPATCH_EVENT, RK_DISPATCH_PUSH,
            RK_NOTIFICATION_ANY, RK_BOARDING_ANY,
            RK_TRIP_ANY, RK_MATCHING_ANY,
            RK_GEO_EVENT,
        )

        try:
            channel = cls.get_channel()

            # Declare DLX and DLQ
            channel.exchange_declare(exchange=QUEUE_DLX, exchange_type='direct', durable=True)
            if cls._declare_bounded_queue(channel, QUEUE_DEAD_LETTER):
                channel.queue_bind(exchange=QUEUE_DLX, queue=QUEUE_DEAD_LETTER, routing_key='dead.letter')

            dlx_args = {
                'x-dead-letter-exchange': QUEUE_DLX,
                'x-dead-letter-routing-key': 'dead.letter'
            }

            # Helper for declaring durable queues with DLX
            def declare_vayy_queue(name, exchange, routing_key):
                if cls._declare_bounded_queue(channel, name, dlx_args):
                    channel.queue_bind(exchange=exchange, queue=name, routing_key=routing_key)

            # Location queues bind ONLY on their own exact key. They also used
            # to bind the "location.*" wildcard, which on a topic exchange
            # matches every location message, so one GPS ping was enqueued to all
            # three queues and would be processed three times over. Nothing
            # publishes to location.topic any more (GPS goes straight to
            # Celery via .delay()), so this was latent - but it would have
            # tripled load the moment consume_location was deployed again.
            def declare_location_queue(name, exchange, routing_key):
                if cls._declare_bounded_queue(channel, name, dlx_args):
                    channel.queue_bind(exchange=exchange, queue=name, routing_key=routing_key)
                    try:
                        channel.queue_unbind(
                            exchange=exchange, queue=name, routing_key="location.*"
                        )
                        logger.info("Removed redundant location.* fanout binding from %r", name)
                    except Exception as e:
                        logger.debug("No location.* binding to remove from %r: %s", name, e)

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
            declare_vayy_queue(QUEUE_DISPATCH_EVENTS, EXCHANGE_DISPATCH, RK_DISPATCH_EVENT)
            declare_vayy_queue(QUEUE_DISPATCH_PUSH, EXCHANGE_DISPATCH, RK_DISPATCH_PUSH)
            declare_vayy_queue(QUEUE_NOTIFICATION_EVENTS, EXCHANGE_NOTIFICATION, RK_NOTIFICATION_ANY)
            declare_vayy_queue(QUEUE_BOARDING, EXCHANGE_BOARDING, RK_BOARDING_ANY)
            declare_vayy_queue(QUEUE_TRIP_EVENTS, EXCHANGE_TRIP, RK_TRIP_ANY)
            declare_vayy_queue(QUEUE_MATCHING, EXCHANGE_MATCHING, RK_MATCHING_ANY)

            if cls._declare_bounded_queue(channel, QUEUE_GEO_EVENTS, dlx_args):
                channel.queue_bind(exchange=EXCHANGE_GEO, queue=QUEUE_GEO_EVENTS, routing_key=RK_GEO_EVENT)

            if cls._unroutable:
                logger.error(
                    "Unroutable publishes seen so far (top 10): %s",
                    sorted(cls._unroutable.items(), key=lambda kv: -kv[1])[:10],
                )

            logger.info("RabbitMQ infrastructure setup completed successfully")

        except pika.exceptions.AMQPError:
            logger.exception("Failed to setup RabbitMQ infrastructure")
            raise
