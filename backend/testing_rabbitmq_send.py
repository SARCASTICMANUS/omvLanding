# import pika

# # 1. Connect
# url = "amqp://admin:password@127.0.0.1:5672/%2F"
# connection = pika.BlockingConnection(pika.URLParameters(url))
# channel = connection.channel()

# # 2. Make sure the queue exists
# channel.queue_declare(queue='hello')

# # 3. Send the message via the default exchange
# channel.basic_publish(exchange='', routing_key='hello', body='Hello World!')
# print(" [x] Sent 'Hello World!'")

# connection.close()
# ---
# new_task.py

# import pika
# import sys

# connection = pika.BlockingConnection(pika.URLParameters("amqp://admin:password@127.0.0.1:5672/%2F"))
# channel = connection.channel()

# # durable=True ensures the queue survives if RabbitMQ crashes/restarts
# channel.queue_declare(queue='task_queue', durable=True)

# message = ' '.join(sys.argv[1:]) or "Default Task..."

# channel.basic_publish(
#     exchange='',
#     routing_key='task_queue',
#     body=message,
#     properties=pika.BasicProperties(
#         delivery_mode=pika.DeliveryMode.Persistent  # Makes the messages survive crashes too
#     )
# )
# print(f" [x] Sent '{message}'")
# connection.close()
# ---
# The Broadcaster (emit_log.py)

import pika
import sys

connection = pika.BlockingConnection(pika.URLParameters("amqp://admin:password@127.0.0.1:5672/%2F"))
channel = connection.channel()

# 1. Declare a named custom fanout exchange
channel.exchange_declare(exchange='logs', exchange_type='fanout')

message = ' '.join(sys.argv[1:]) or "info: Hello World!"

# 2. Publish directly to the exchange. routing_key is empty because fanout ignores it.
channel.basic_publish(exchange='logs', routing_key='', body=message)

print(f" [x] Broadcasted '{message}'")
connection.close()