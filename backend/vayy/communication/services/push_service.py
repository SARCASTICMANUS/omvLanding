import logging

import requests
from django.conf import settings

logger = logging.getLogger(__name__)


class PushDeliveryError(Exception):
    """
    Raised when a push could not be handed to the provider.

    Distinguishing this from a hard "returned False" matters: the Celery task
    retries on exception, so a transient provider outage is retried, whereas a
    permanently undeliverable message ends in failed status.
    """


class PushService:
    """
    Mobile push delivery via the Expo Push API.

    The clients are Expo apps (expo-notifications), and they register their
    token against POST /api/accounts/push-token/ onto User.push_token. So
    delivery is a single HTTP call to Expo, not an FCM credentials flow.

    This previously returned True unconditionally, which meant every push
    notification was marked sent while nothing had been delivered anywhere.
    """

    @staticmethod
    def send(user, title, message, data=None) -> bool:
        token = (getattr(user, "push_token", None) or "").strip()
        if not token:
            # Not a transient fault: the client never registered (or the token
            # was rejected by the push-token endpoint). Retrying will not fix
            # it, so report failure rather than raising.
            logger.warning(
                "No push token registered for user %s; cannot deliver push", user.id
            )
            return False

        payload = {
            "to": token,
            "title": title,
            "body": message,
            "sound": "default",
            "data": data or {},
        }
        headers = {
            "Content-Type": "application/json",
            "Accept": "application/json",
        }
        if getattr(settings, "EXPO_ACCESS_TOKEN", ""):
            headers["Authorization"] = f"Bearer {settings.EXPO_ACCESS_TOKEN}"

        url = getattr(settings, "EXPO_PUSH_URL", None)
        if not url:
            logger.error("EXPO_PUSH_URL is not configured; cannot deliver push")
            return False

        try:
            response = requests.post(
                url,
                json=payload,
                headers=headers,
                timeout=getattr(settings, "PUSH_TIMEOUT_SECONDS", 10),
            )
        except requests.RequestException as exc:
            # Network/timeout/5xx: worth retrying.
            logger.warning("Expo push request failed for user %s: %s", user.id, exc)
            raise PushDeliveryError(f"Expo push request failed: {exc}") from exc

        if response.status_code >= 500:
            raise PushDeliveryError(
                f"Expo push provider returned {response.status_code}"
            )

        if response.status_code >= 400:
            # 4xx is a permanent rejection (bad/expired token, malformed
            # payload). Retrying cannot help.
            logger.error(
                "Expo push rejected for user %s (HTTP %s): %s",
                user.id,
                response.status_code,
                response.text[:500],
            )
            return False

        try:
            body = response.json()
        except ValueError:
            logger.warning("Expo push returned non-JSON body: %s", response.text[:200])
            return True

        errors = body.get("data") or []
        if isinstance(errors, list):
            for item in errors:
                if isinstance(item, dict) and item.get("status") == "error":
                    code = item.get("code")
                    detail = item.get("message")
                    if code == "DeviceNotRegistered":
                        # Token is dead. Clear it so we stop retrying this user.
                        logger.warning(
                            "Push token for user %s is no longer registered; clearing it",
                            user.id,
                        )
                        _clear_push_token(user)
                        return False
                    logger.error(
                        "Expo push error for user %s: %s (%s)", user.id, detail, code
                    )
                    return False

        logger.info("Push delivered to user %s", user.id)
        return True


def _clear_push_token(user):
    try:
        user.push_token = ""
        user.save(update_fields=["push_token"])
    except Exception as exc:  # pragma: no cover - best effort cleanup
        logger.warning("Could not clear stale push token for user %s: %s", user.id, exc)
