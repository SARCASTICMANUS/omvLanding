import json
import logging

from django.core.cache import cache
from common.constants import REGISTRATION_PAYLOAD_PREFIX, REGISTRATION_PAYLOAD_TTL

logger = logging.getLogger(__name__)


class RegistrationService:

    @classmethod
    def _key(cls, job_id):
        return f"{REGISTRATION_PAYLOAD_PREFIX}:{job_id}"

    @classmethod
    def save_payload(cls, job_id, user_id, payload):
        data = {"user_id": str(user_id), "payload": payload}
        try:
            cache.client.get_client().setex(
                cls._key(job_id), REGISTRATION_PAYLOAD_TTL, json.dumps(data)
            )
        except Exception:
            logger.warning("[RegistrationService] Failed to save payload for job %s", job_id, exc_info=True)

    @classmethod
    def get_payload(cls, job_id):
        try:
            raw = cache.client.get_client().get(cls._key(job_id))
            if not raw:
                return None
            return json.loads(raw)
        except Exception:
            logger.warning("[RegistrationService] Failed to get payload for job %s", job_id, exc_info=True)
            return None

    @classmethod
    def cleanup(cls, job_id):
        try:
            cache.client.get_client().delete(cls._key(job_id))
        except Exception:
            logger.warning("[RegistrationService] Failed to cleanup job %s", job_id, exc_info=True)
