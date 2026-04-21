import redis
import redis.asyncio as aioredis
import os
from django.conf import settings

# Get REDIS_URL from settings or environment
REDIS_URL = getattr(settings, "REDIS_URL", os.environ.get("REDIS_URL", "redis://localhost:6379"))

def get_redis_client():
    """Returns a synchronous redis client."""
    return redis.from_url(REDIS_URL, decode_responses=True)

def get_async_redis_client():
    """Returns an asynchronous redis client."""
    return aioredis.from_url(REDIS_URL, decode_responses=True)

# Helper functions for synchronous operations
def set_value(key, value, ex=None):
    client = get_redis_client()
    return client.set(key, value, ex=ex)

def get_value(key):
    client = get_redis_client()
    return client.get(key)

def delete_key(key):
    client = get_redis_client()
    return client.delete(key)

def publish_message(channel, message):
    client = get_redis_client()
    return client.publish(channel, message)
