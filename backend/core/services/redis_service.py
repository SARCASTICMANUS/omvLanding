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

def add_recent_search(user_id, search_data):
    """
    Saves a search to a user's recent list in Redis.
    Keeps only the last 3.
    search_data should be a JSON-serializable dict.
    """
    import json
    client = get_redis_client()
    key = f"recent_searches:{user_id}"
    val = json.dumps(search_data)
    
    # Remove existing if same (to move to front)
    client.lrem(key, 0, val)
    # Push to head
    client.lpush(key, val)
    # Trim to 3
    client.ltrim(key, 0, 2)

def get_recent_searches(user_id):
    """Retrieves the last 3 searches for a user."""
    import json
    client = get_redis_client()
    key = f"recent_searches:{user_id}"
    items = client.lrange(key, 0, 2)
    return [json.loads(i) for i in items]
