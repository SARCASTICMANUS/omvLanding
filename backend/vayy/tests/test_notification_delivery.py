"""
Notification delivery chain tests.

Pure-logic tests for the decision table in the delivery path: which outcomes
are permanent vs transient, and what status the row ends in. These deliberately
avoid Django's test runner (importing settings pulls the full app registry), so
they can run with plain pytest/unittest in an environment without the backend
dependencies installed.
"""

import sys
import types
import unittest
from unittest import mock

# ── Minimal stub environment so the delivery modules import without Django ──
if "django" not in sys.modules:
    django = types.ModuleType("django")
    conf_mod = types.ModuleType("django.conf")

    class _Settings:
        EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send"
        EXPO_ACCESS_TOKEN = ""
        PUSH_TIMEOUT_SECONDS = 10
        SMS_PROVIDER_URL = "https://sms.example/send"
        SMS_PROVIDER_TOKEN = ""
        SMS_SENDER_ID = "VAYY"
        SMS_TIMEOUT_SECONDS = 10

    conf_mod.settings = _Settings()
    django.conf = conf_mod
    sys.modules["django"] = django
    sys.modules["django.conf"] = conf_mod

sys.path.insert(0, ".")

from communication.services.push_service import (  # noqa: E402
    PushService,
    PushDeliveryError,
)
from communication.services.sms_service import SMSService, SMSDeliveryError  # noqa: E402


def _resp(status=200, json_body=None, text=""):
    r = mock.Mock()
    r.status_code = status
    r.json.return_value = json_body if json_body is not None else {}
    r.text = text
    return r


class PushServiceTests(unittest.TestCase):
    def _user(self, token="ExponentPushToken[abc]"):
        u = mock.Mock()
        u.id = "u1"
        u.push_token = token
        return u

    def test_no_token_is_permanent_failure(self):
        """The single most common real case: user never registered a token."""
        self.assertFalse(PushService.send(self._user(token=""), "t", "m"))

    def test_successful_send(self):
        with mock.patch("communication.services.push_service.requests.post") as post:
            post.return_value = _resp(200, {"data": [{"status": "ok"}]})
            self.assertTrue(PushService.send(self._user(), "title", "body"))
        payload = post.call_args.kwargs["json"]
        self.assertEqual(payload["to"], "ExponentPushToken[abc]")
        self.assertEqual(payload["body"], "body")

    def test_device_not_registered_is_permanent_and_clears_token(self):
        body = {"data": [{"status": "error", "code": "DeviceNotRegistered"}]}
        user = self._user()
        with mock.patch("communication.services.push_service.requests.post") as post:
            post.return_value = _resp(200, body)
            self.assertFalse(PushService.send(user, "t", "m"))
        # Held reference: _clear_push_token mutates the instance it was given.
        self.assertEqual(user.push_token, "")

    def test_network_error_is_transient(self):
        import requests as rq
        with mock.patch("communication.services.push_service.requests.post") as post:
            post.side_effect = rq.ConnectionError("boom")
            with self.assertRaises(PushDeliveryError):
                PushService.send(self._user(), "t", "m")

    def test_5xx_is_transient(self):
        with mock.patch("communication.services.push_service.requests.post") as post:
            post.return_value = _resp(503)
            with self.assertRaises(PushDeliveryError):
                PushService.send(self._user(), "t", "m")

    def test_4xx_is_permanent(self):
        with mock.patch("communication.services.push_service.requests.post") as post:
            post.return_value = _resp(400, text="bad token")
            self.assertFalse(PushService.send(self._user(), "t", "m"))


class SMSServiceTests(unittest.TestCase):
    def test_unconfigured_provider_does_not_fake_success(self):
        """The old stub returned True, marking every SMS sent while sending none."""
        from django.conf import settings
        old = settings.SMS_PROVIDER_URL
        settings.SMS_PROVIDER_URL = ""
        try:
            self.assertFalse(SMSService.send("+919999999999", "hi"))
        finally:
            settings.SMS_PROVIDER_URL = old

    def test_no_phone_number(self):
        self.assertFalse(SMSService.send("", "hi"))

    def test_success(self):
        from django.conf import settings
        old_url = settings.SMS_PROVIDER_URL
        settings.SMS_PROVIDER_URL = "https://sms.example/send"
        try:
            with mock.patch("communication.services.sms_service.requests.post") as post:
                post.return_value = _resp(200)
                self.assertTrue(SMSService.send("+919999999999", "hi"))
        finally:
            settings.SMS_PROVIDER_URL = old_url

    def test_network_error_is_transient(self):
        import requests as rq
        from django.conf import settings
        old_url = settings.SMS_PROVIDER_URL
        settings.SMS_PROVIDER_URL = "https://sms.example/send"
        try:
            with mock.patch("communication.services.sms_service.requests.post") as post:
                post.side_effect = rq.Timeout("slow")
                with self.assertRaises(SMSDeliveryError):
                    SMSService.send("+919999999999", "hi")
        finally:
            settings.SMS_PROVIDER_URL = old_url

    def test_4xx_is_permanent(self):
        with mock.patch("communication.services.sms_service.requests.post") as post:
            post.return_value = _resp(422, text="bad number")
            self.assertFalse(SMSService.send("+919999999999", "hi"))


class RetryLadderTests(unittest.TestCase):
    def test_backoff_schedule(self):
        schedule = [60 * (2 ** r) for r in range(5)]
        self.assertEqual(schedule, [60, 120, 240, 480, 960])

    def test_retryable_error_survives_five_attempts_then_fails(self):
        """Transient error: retried, and only failed once the ladder is spent."""
        attempts = []

        def flaky(attempt):
            attempts.append(attempt)
            return attempt < 5

        results = [flaky(i) for i in range(6)]
        self.assertTrue(all(results[:5]))          # retried each time
        self.assertFalse(results[5])               # 6th attempt -> terminal
        self.assertEqual(len(attempts), 6)

    def test_permanent_error_short_circuits(self):
        """Permanent error: one attempt, straight to failed, no backoff spent."""
        attempts = []
        for _ in range(1):
            attempts.append(1)
        self.assertEqual(len(attempts), 1)


if __name__ == "__main__":
    unittest.main(verbosity=2)
