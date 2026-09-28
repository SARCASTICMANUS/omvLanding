import logging

import requests
from django.conf import settings

logger = logging.getLogger(__name__)


class SMSDeliveryError(Exception):
    """
    Raised on a transient SMS failure so the Celery task retries it.
    """


class SMSService:
    """
    SMS delivery through a provider-agnostic HTTP gateway.

    No provider (Twilio/MSG91/Gupshup) is wired up in this codebase and none is
    installed. Rather than keep the old `return True` stub - which marked every
    SMS notification sent while sending nothing - this sends through a
    configurable JSON gateway and reports honestly:

      * no recipient      -> False (permanent)
      * not configured    -> False (permanent, and loudly logged)
      * network error/5xx -> raises, so Celery retries with backoff
      * 4xx               -> False (permanent)
    """

    @staticmethod
    def send(phone_number, message) -> bool:
        if not phone_number:
            logger.warning("No phone number available; cannot send SMS")
            return False

        url = getattr(settings, "SMS_PROVIDER_URL", "")
        if not url:
            logger.error(
                "SMS_PROVIDER_URL is not configured; refusing to mark SMS as sent. "
                "Configure a provider or stop using notification_type='sms'."
            )
            return False

        headers = {"Content-Type": "application/json"}
        token = getattr(settings, "SMS_PROVIDER_TOKEN", "")
        if token:
            headers["Authorization"] = f"Bearer {token}"

        payload = {
            "to": phone_number,
            "message": message,
            "sender_id": getattr(settings, "SMS_SENDER_ID", "VAYY"),
        }

        try:
            response = requests.post(
                url,
                json=payload,
                headers=headers,
                timeout=getattr(settings, "SMS_TIMEOUT_SECONDS", 10),
            )
        except requests.RequestException as exc:
            logger.warning("SMS request failed for %s: %s", phone_number, exc)
            raise SMSDeliveryError(f"SMS request failed: {exc}") from exc

        if response.status_code >= 500:
            raise SMSDeliveryError(f"SMS provider returned {response.status_code}")

        if response.status_code >= 400:
            logger.error(
                "SMS rejected for %s (HTTP %s): %s",
                phone_number,
                response.status_code,
                response.text[:500],
            )
            return False

        logger.info("SMS dispatched to %s", phone_number)
        return True
