import unittest
from types import SimpleNamespace
from unittest.mock import patch

from common.middleware import RequestResponseLoggingMiddleware


class MultipartRequest:
    content_type = "multipart/form-data; boundary=upload-boundary"
    method = "POST"
    path = "/api/transport/admin/onboarding/"
    GET = {}
    user = SimpleNamespace(id="admin")
    correlation_id = "test-request"

    @property
    def body(self):
        raise AssertionError("multipart request body must remain unread by logging middleware")


class Response(dict):
    status_code = 401
    content = b'{"detail":"authentication required"}'


class RequestResponseMiddlewareTests(unittest.TestCase):
    def test_multipart_upload_does_not_read_body_before_view(self):
        response = Response({"Content-Type": "application/json"})
        middleware = RequestResponseLoggingMiddleware(lambda _request: response)

        with patch("common.middleware.logger.info"):
            result = middleware(MultipartRequest())

        self.assertIs(result, response)


if __name__ == "__main__":
    unittest.main()
