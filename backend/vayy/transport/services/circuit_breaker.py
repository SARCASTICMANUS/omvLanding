import logging
import os
import time

from django.core.cache import cache

logger = logging.getLogger(__name__)

FAILURES_KEY = "geocode:breaker:failures"
OPEN_UNTIL_KEY = "geocode:breaker:open_until"

FAILURE_WINDOW_TTL = 300


def _threshold() -> int:
    try:
        return max(1, int(os.environ.get("GEOCODE_BREAKER_THRESHOLD", "5")))
    except (TypeError, ValueError):
        return 5


def _cooldown() -> int:
    try:
        return max(1, int(os.environ.get("GEOCODE_BREAKER_COOLDOWN", "60")))
    except (TypeError, ValueError):
        return 60


class GeocodeCircuitBreaker:
    """
    Redis-backed circuit breaker for the external geocoding API.

    States:
    - CLOSED: normal operation, external calls allowed.
    - OPEN: consecutive failures reached the threshold; external calls skipped
      until the cooldown expires.
    - HALF-OPEN (emergent): after the cooldown expires the next request acts as
      a probe - success closes the breaker, failure re-opens it.

    Fails open when Redis is unavailable so geocoding is never blocked by the
    breaker's own dependency.
    """

    @staticmethod
    def is_open() -> bool:
        try:
            open_until = cache.get(OPEN_UNTIL_KEY)
        except Exception as exc:
            logger.warning("Geocode breaker unavailable (fail-open): %s", exc)
            return False
        if open_until is None:
            return False
        return time.time() < float(open_until)

    @staticmethod
    def record_success() -> None:
        try:
            cache.delete(FAILURES_KEY)
            cache.delete(OPEN_UNTIL_KEY)
        except Exception as exc:
            logger.warning("Geocode breaker could not record success: %s", exc)

    @staticmethod
    def record_failure() -> None:
        try:
            try:
                cache.incr(FAILURES_KEY)
            except ValueError:
                cache.add(FAILURES_KEY, 1, FAILURE_WINDOW_TTL)
            failures = cache.get(FAILURES_KEY) or 0
            if failures >= _threshold():
                cooldown = _cooldown()
                cache.set(OPEN_UNTIL_KEY, time.time() + cooldown, cooldown + 1)
                logger.error(
                    "Geocode breaker OPEN after %s consecutive failures (cooldown %ss)",
                    failures,
                    cooldown,
                )
        except Exception as exc:
            logger.warning("Geocode breaker could not record failure: %s", exc)
