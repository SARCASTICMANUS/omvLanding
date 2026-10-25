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

        try:
            response = self.get_response(request)
        finally:
            # Clear thread-local to prevent leak across requests in thread pool
            _thread_locals.correlation_id = None

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
        content_type = request.content_type or ""
        is_multipart = content_type.lower().startswith("multipart/form-data")
        # Reading request.body first triggers Django's default 2.5 MB limit,
        # rejecting larger file uploads before DRF's multipart parser runs.
        req_body = b"" if is_multipart else request.body
        req_data = {}
        if req_body:
            try:
                req_data = _sanitize(json.loads(req_body))
            except (json.JSONDecodeError, TypeError):
                req_data = {"_raw": req_body[:1000].decode("utf-8", "replace")}
        req_query = dict(request.GET) if request.GET else {}

        response = self.get_response(request)

        # Log AFTER view execution — DRF auth has resolved request.user by now
        user_id = getattr(getattr(request, "user", None), "id", "anonymous")
        logger.info(
            "REQUEST  %s %s  [user=%s] [query=%s] [data=%s] [correlation_id=%s]",
            request.method,
            request.path,
            user_id,
            json.dumps(req_query, default=str),
            json.dumps(req_data, default=str),
            getattr(request, "correlation_id", "-"),
        )

        self._log_response(request, response, user_id)
        return response

    def _log_response(self, request, response, user_id=None):
        resp_body = ""
        ct = response.get("Content-Type", "")
        if "application/json" in ct:
            try:
                resp_body = json.loads(response.content) if response.content else {}
            except Exception:
                resp_body = str(response.content[:1000])

        logger.info(
            "RESPONSE %s %s  [user=%s] [status=%s] [data=%s] [correlation_id=%s]",
            request.method,
            request.path,
            user_id or getattr(getattr(request, "user", None), "id", "anonymous"),
            response.status_code,
            json.dumps(resp_body, default=str)[:2000],
            getattr(request, "correlation_id", "-"),
        )


class GeoIPMiddleware:
    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        # Capture client_ip from request body before DRF consumes it.
        # Must match the real route in kpi/api/urls.py ("track/"). This used to
        # be "track-page-view", which is not a registered URL, so _client_ip
        # always stayed "" and the guard below returned early on every request —
        # meaning no GeoEvent row was ever written and /api/kpi/geo-stats/
        # ?source=geoevent always came back empty.
        _client_ip = ""
        if request.path.startswith("/api/kpi/track/"):
            try:
                import json
                body = json.loads(request.body) if request.body else {}
                _client_ip = body.get("client_ip", "")
            except (json.JSONDecodeError, AttributeError):
                pass

        response = self.get_response(request)

        try:
            if not _client_ip and not request.path.startswith("/api/kpi/track/"):
                return response

            from tracking.services.geoip_service import lookup_geoip
            from tracking.models import GeoEvent
            from django.contrib.gis.geos import Point

            ip_address = _client_ip or _get_client_ip(request)

            geo_data = lookup_geoip(ip_address)
            if geo_data is None:
                return response

            location = None
            if geo_data["latitude"] is not None and geo_data["longitude"] is not None:
                location = Point(float(geo_data["longitude"]), float(geo_data["latitude"]), srid=4326)

            GeoEvent.objects.create(
                ip_address=ip_address,
                city=geo_data["city"],
                region=geo_data["region"],
                country=geo_data["country"],
                country_code=geo_data["country_code"],
                location=location,
                latitude=geo_data["latitude"],
                longitude=geo_data["longitude"],
                timezone=geo_data["timezone"],
            )

            try:
                from tracking.tasks import publish_geo_event
                publish_geo_event.delay({
                    "ip_address": ip_address,
                    "city": geo_data["city"],
                    "region": geo_data["region"],
                    "country": geo_data["country"],
                    "country_code": geo_data["country_code"],
                    "latitude": geo_data["latitude"],
                    "longitude": geo_data["longitude"],
                    "timezone": geo_data["timezone"],
                })
            except Exception as e:
                logger.warning(f"Failed to queue geo event: {e}")

        except Exception as e:
            logger.warning(f"GeoIP middleware error for {request.path}: {e}")

        return response


def _get_client_ip(request):
    x_forwarded_for = request.META.get("HTTP_X_FORWARDED_FOR")
    if x_forwarded_for:
        return x_forwarded_for.split(",")[0].strip()
    return request.META.get("REMOTE_ADDR", "")
