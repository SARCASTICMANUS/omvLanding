import logging

from celery import shared_task

logger = logging.getLogger(__name__)


@shared_task(
    bind=True,
    max_retries=3,
    default_retry_delay=30,
    queue="celery",
    ignore_result=True,
)
def warm_geocode_cache(self, query, limit=5, country_codes="in"):
    """
    Warm-up task: fetch external geocoding results for a query and store them
    in Redis (TTL 24h) under the same cache key used by GeocodeSearchAPIView,
    so the next request hits the cache.

    Skips (reschedules with backoff) while the geocode circuit breaker is open.
    """
    from django.core.cache import cache

    from transport.services.circuit_breaker import GeocodeCircuitBreaker
    from transport.services.geocoding_service import (
        GEOCODE_CACHE_TTL,
        GeocodingService,
        build_search_cache_key,
        normalize_query,
    )

    normalized = normalize_query(query)
    if not normalized:
        return

    breaker = GeocodeCircuitBreaker()
    if breaker.is_open():
        logger.warning(
            "Geocode breaker open; retrying warm-up for query: %s", normalized
        )
        raise self.retry(countdown=self.default_retry_delay * (self.request.retries + 1))

    results, ok = GeocodingService.search_nominatim(
        normalized,
        limit=limit,
        country_codes=country_codes,
        timeout=10,
    )
    if not ok:
        logger.error("Geocode warm-up failed for query: %s", normalized)
        raise self.retry(countdown=self.default_retry_delay * (self.request.retries + 1))

    breaker.record_success()

    try:
        cache.set(
            build_search_cache_key(normalized, limit, country_codes),
            results,
            GEOCODE_CACHE_TTL,
        )
        logger.info("Geocode cache warmed for query: %s", normalized)
    except Exception as exc:
        logger.warning("Could not cache geocode warm-up result: %s", exc)
