import uuid
import logging
from threading import local

_thread_locals = local()

def get_correlation_id():
    return getattr(_thread_locals, 'correlation_id', None)

class CorrelationIDMiddleware:
    """
    Middleware to handle Correlation IDs for tracing requests across microservices and async workers.
    """
    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        # Extract from header or generate new
        correlation_id = request.headers.get('X-Correlation-ID', str(uuid.uuid4()))
        
        # Set in thread local for logging and service access
        _thread_locals.correlation_id = correlation_id
        
        # Add to request object
        request.correlation_id = correlation_id

        response = self.get_response(request)
        
        # Return in response header
        response['X-Correlation-ID'] = correlation_id
        return response


class CorrelationIDFilter(logging.Filter):
    """
    Logging filter to include correlation_id in logs.
    """
    def filter(self, record):
        record.correlation_id = get_correlation_id() or "-"
        return True
