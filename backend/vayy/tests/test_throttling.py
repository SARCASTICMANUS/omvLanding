"""
Throttle configuration tests.

Regression guard for the bug where DEFAULT_THROTTLE_RATES was commented out
entirely. ScopedRateThrottle raises ImproperlyConfigured when its scope is
missing from DEFAULT_THROTTLE_RATES, which surfaced as an HTTP 500 on every
GPS ping rather than as a 429.
"""

from unittest.mock import patch

import pytest
from django.conf import settings
from django.core.cache import cache
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APIClient

from accounts.models import User
from common.constants import ROLE_BIKE_DRIVER


def _rates():
    return settings.REST_FRAMEWORK["DEFAULT_THROTTLE_RATES"]


def _num_requests(rate_string):
    """'90/min' -> 90. These tests only need the request count."""
    return int(rate_string.split("/")[0])


@pytest.mark.django_db
class TestScopedThrottleRatesAreDefined:
    """No view may reference a scope that is missing from the settings."""

    def test_every_referenced_scope_is_defined(self):
        # Mirrors the `throttle_scope` values declared across the codebase.
        declared_scopes = {"gps", "gps_day", "waitlist", "kpi_track"}

        missing = declared_scopes - set(_rates())
        assert not missing, f"views reference undefined throttle scopes: {missing}"

    def test_default_throttle_classes_have_backing_rates(self):
        """AnonRateThrottle / UserRateThrottle resolve 'anon' and 'user'."""
        rates = _rates()
        assert "anon" in rates, "AnonRateThrottle would raise ImproperlyConfigured"
        assert "user" in rates, "UserRateThrottle would raise ImproperlyConfigured"

    def test_gps_rate_supports_a_one_hz_stream(self):
        """1 Hz == 60 req/min, so the per-minute cap must clear that."""
        assert _num_requests(_rates()["gps"]) >= 60

    def test_gps_day_rate_bounds_a_full_streaming_day(self):
        """1 Hz across a 12h shift is ~43,200 requests."""
        assert _num_requests(_rates()["gps_day"]) >= 43200

    def test_gps_day_is_stricter_than_a_full_day_of_streaming(self):
        """The daily ceiling must actually bound something."""
        assert _num_requests(_rates()["gps_day"]) < 86400


@pytest.mark.django_db
class TestGPSThrottleEnforcement:
    """The GPS endpoint allows a burst, then returns 429."""

    @pytest.fixture(autouse=True)
    def _clear_throttle_cache(self):
        cache.clear()
        yield
        cache.clear()

    @pytest.fixture
    def api_client(self):
        return APIClient()

    @pytest.fixture
    def driver(self):
        return User.objects.create_user(
            email="gps_driver@example.com",
            password="password",
            role=ROLE_BIKE_DRIVER,
        )

    @pytest.fixture
    def payload(self):
        # vehicle_id is optional; omitting it keeps the test focused on
        # throttling rather than on vehicle-ownership checks.
        return {"lat": 12.9716, "lng": 77.5946, "speed": 40, "heading": 180}

    def _post(self, api_client, payload):
        # GPSService.ingest publishes to Celery; stub it so this test measures
        # throttling only, not broker availability.
        with patch("tracking.tasks.process_location_update.delay"):
            return api_client.post(reverse("gps-ingest"), payload)

    def test_first_five_requests_are_allowed(self, api_client, driver, payload):
        api_client.force_authenticate(user=driver)

        for attempt in range(1, 6):
            response = self._post(api_client, payload)
            # The view returns 201 CREATED on success, not 200.
            assert response.status_code == status.HTTP_201_CREATED, (
                f"request {attempt} should be allowed, got "
                f"{response.status_code}: {getattr(response, 'data', None)}"
            )

    def test_request_past_the_limit_returns_429(self, api_client, driver, payload):
        api_client.force_authenticate(user=driver)
        limit = _num_requests(_rates()["gps"])

        # Burn the whole per-minute budget; each of these is allowed.
        for attempt in range(1, limit + 1):
            response = self._post(api_client, payload)
            assert response.status_code == status.HTTP_201_CREATED, (
                f"request {attempt} of {limit} should be allowed, "
                f"got {response.status_code}"
            )

        # One past the limit must be rejected.
        response = self._post(api_client, payload)
        assert response.status_code == status.HTTP_429_TOO_MANY_REQUESTS, (
            f"request {limit + 1} should be throttled, got {response.status_code}"
        )

        # And the throttle must stay closed on the next attempt.
        response = self._post(api_client, payload)
        assert response.status_code == status.HTTP_429_TOO_MANY_REQUESTS

    def test_throttle_is_scoped_per_user(self, api_client, driver, payload):
        """One driver's exhausted budget must not throttle another."""
        api_client.force_authenticate(user=driver)
        limit = _num_requests(_rates()["gps"])
        for _ in range(limit + 1):
            self._post(api_client, payload)
        assert self._post(api_client, payload).status_code == (
            status.HTTP_429_TOO_MANY_REQUESTS
        )

        other = User.objects.create_user(
            email="gps_driver_2@example.com",
            password="password",
            role=ROLE_BIKE_DRIVER,
        )
        api_client.force_authenticate(user=other)
        assert self._post(api_client, payload).status_code == (
            status.HTTP_201_CREATED
        )
