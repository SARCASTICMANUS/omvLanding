# import pika
# import sys
# import os

# def main():
#     url = "amqp://admin:password@127.0.0.1:5672/%2F"
#     connection = pika.BlockingConnection(pika.URLParameters(url))
#     channel = connection.channel()

#     # Always declare the queue on both sides (in case consumer starts first)
#     channel.queue_declare(queue='hello')

#     # Define what to do when a message arrives
#     def callback(ch, method, properties, body):
#         print(f" [x] Received {body.decode()}")

#     # Tell RabbitMQ to use our callback function for the 'hello' queue
#     channel.basic_consume(queue='hello', on_message_callback=callback, auto_ack=True)

#     print(' [*] Waiting for messages. To exit press CTRL+C')
#     channel.start_consuming()

# if __name__ == '__main__':
#     try:
#         main()
#     except KeyboardInterrupt:
#         print('Interrupted')
#         try:
#             sys.exit(0)
#         except SystemExit:
#             os._exit(0)
# ---
# worker.py

# import pika
# import time

# connection = pika.BlockingConnection(pika.URLParameters("amqp://admin:password@127.0.0.1:5672/%2F"))
# channel = connection.channel()

# channel.queue_declare(queue='task_queue', durable=True)

# def callback(ch, method, properties, body):
#     print(f" [x] Received {body.decode()}")
    
#     # Simulate heavy processing (e.g., STT transcription)
#     # Every dot in the message equals 1 second of work
#     time.sleep(body.count(b'.')) 
    
#     print(" [x] Done!")
#     # MANUALLY ACKNOWLEDGE THE TASK
#     ch.basic_ack(delivery_tag=method.delivery_tag)

# # Fair dispatch configuration
# channel.basic_qos(prefetch_count=1)

# # Notice auto_ack is now False! We handle it manually inside the callback.
# channel.basic_consume(queue='task_queue', on_message_callback=callback)

# print(' [*] Waiting for audio tasks. To exit press CTRL+C')
# channel.start_consuming()
# ---
# The Subscriber (receive_logs.py)
import pika

connection = pika.BlockingConnection(pika.URLParameters("amqp://admin:password@127.0.0.1:5672/%2F"))
channel = connection.channel()

channel.exchange_declare(exchange='logs', exchange_type='fanout')

# Create a temporary queue with a random name unique to this specific running script.
# exclusive=True means delete the queue once this script stops running.
result = channel.queue_declare(queue='', exclusive=True)
queue_name = result.method.queue

# Bind our temporary queue to the broadcast exchange
channel.queue_bind(exchange='logs', queue=queue_name)

def callback(ch, method, properties, body):
    print(f" [x] Log Consumer got: {body.decode()}")

channel.basic_consume(queue=queue_name, on_message_callback=callback, auto_ack=True)

print(' [*] Waiting for broadcasts. To exit press CTRL+C')
channel.start_consuming()