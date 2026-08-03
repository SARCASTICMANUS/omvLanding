import json
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


SENSITIVE_KEYS = {"password", "token", "access", "refresh", "secret", "authorization", "new_password", "old_password"}


def _sanitize(data):
    """Mask sensitive fields recursively."""
    if isinstance(data, dict):
        return {k: "***MASKED***" if k.lower() in SENSITIVE_KEYS else _sanitize(v) for k, v in data.items()}
    if isinstance(data, list):
        return [_sanitize(i) for i in data]
    return data


logger = logging.getLogger("vayy.request_response")


class RequestResponseLoggingMiddleware:
    """
    Middleware that logs every incoming request and outgoing response.
    Replaces all _log_request / _log_response helper functions across the codebase.
    Sensitive fields (password, token, etc.) are masked automatically.
    """

    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        self._log_request(request)
        response = self.get_response(request)
        self._log_response(request, response)
        return response

    def _log_request(self, request):
        body = getattr(request, "body", b"")
        data = {}
        if body:
            try:
                data = _sanitize(json.loads(body))
            except (json.JSONDecodeError, TypeError):
                data = {"_raw": body[:1000].decode("utf-8", "replace")}

        query_params = dict(request.GET) if request.GET else {}

        logger.info(
            "REQUEST  %s %s  [user=%s] [query=%s] [data=%s] [correlation_id=%s]",
            request.method,
            request.path,
            getattr(getattr(request, "user", None), "id", "anonymous"),
            json.dumps(query_params, default=str),
            json.dumps(data, default=str),
            getattr(request, "correlation_id", "-"),
        )

    def _log_response(self, request, response):
        resp_body = ""
        ct = response.get("Content-Type", "")
        if "application/json" in ct:
            try:
                resp_body = json.loads(response.content) if response.content else {}
            except Exception:
                resp_body = str(response.content[:1000])

        logger.info(
            "RESPONSE %s %s  [status=%s] [data=%s] [correlation_id=%s]",
            request.method,
            request.path,
            response.status_code,
            json.dumps(resp_body, default=str)[:2000],
            getattr(request, "correlation_id", "-"),
        )
