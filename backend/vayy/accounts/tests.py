from django.contrib.auth import get_user_model
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase
from django.core.files.uploadedfile import SimpleUploadedFile
from unittest.mock import patch
from accounts.models import DriverDocument


User = get_user_model()


class AdminUserCreationTests(APITestCase):
    def setUp(self):
        self.admin = User.objects.create_superuser(
            email="admin@example.test",
            password="test-password-123",
        )
        self.client.force_authenticate(self.admin)
        self.url = reverse("user-list")

    def test_admin_can_create_multiple_users_without_username_field(self):
        payloads = [
            {
                "first_name": "First",
                "last_name": "Driver",
                "email": "first.driver@example.test",
                "password": "safe-password-123",
                "role": "bikedriver",
                "is_staff": False,
            },
            {
                "first_name": "Second",
                "last_name": "Driver",
                "email": "second.driver@example.test",
                "password": "safe-password-456",
                "role": "bikedriver",
                "is_staff": False,
            },
        ]

        responses = [self.client.post(self.url, payload, format="json") for payload in payloads]

        self.assertEqual([r.status_code for r in responses], [status.HTTP_201_CREATED] * 2)
        users = [User.objects.get(email=payload["email"]) for payload in payloads]
        self.assertTrue(all(user.username for user in users))
        self.assertEqual(len({user.username for user in users}), 2)
        self.assertTrue(all(user.check_password(payload["password"]) for user, payload in zip(users, payloads)))

    def test_long_email_still_gets_valid_unique_username(self):
        email = ("long." + "x" * 150 + "@example.test")
        response = self.client.post(
            self.url,
            {
                "email": email,
                "first_name": "Long",
                "last_name": "Email",
                "role": "bikedriver",
                "is_staff": False,
            },
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED, response.data)
        user = User.objects.get(email=email)
        self.assertTrue(user.username)
        self.assertLessEqual(len(user.username), User._meta.get_field("username").max_length)
        self.assertFalse(user.has_usable_password())

    def test_duplicate_email_returns_validation_error_not_server_error(self):
        User.objects.create_user(email="already.exists@example.test", password="test-password")
        response = self.client.post(
            self.url,
            {
                "email": "already.exists@example.test",
                "first_name": "Duplicate",
                "last_name": "User",
                "role": "bikedriver",
                "is_staff": False,
            },
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    @patch("communication.tasks.send_otp_task.delay")
    def test_admin_can_resend_email_verification(self, send_otp):
        user = User.objects.create_user(
            email="resend@example.test", password="safe-password-123", role="bikedriver"
        )
        response = self.client.post(reverse("user-send-verification", args=[user.pk]), {}, format="json")
        self.assertEqual(response.status_code, status.HTTP_200_OK, response.data)
        user.refresh_from_db()
        self.assertTrue(user.otp)
        self.assertFalse(user.is_verified)
        send_otp.assert_called_once_with(user.id, user.otp)

    def test_admin_uploads_document_to_selected_driver_not_admin(self):
        driver = User.objects.create_user(
            email="upload.driver@example.test", password="safe-password-123", role="bikedriver"
        )
        uploaded = SimpleUploadedFile("license.pdf", b"%PDF-test", content_type="application/pdf")
        response = self.client.post(
            f"/api/accounts/driver/documents/?user_id={driver.pk}",
            {"document_type": "LICENSE", "doc_key": "dlFront", "file": uploaded},
            format="multipart",
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED, response.data)
        document = DriverDocument.objects.get(pk=response.data["id"])
        self.assertEqual(document.driver_id, driver.pk)
        self.assertNotEqual(document.driver_id, self.admin.pk)
        self.assertEqual(document.status, "PENDING")
        self.assertEqual(document.doc_key, "dlFront")
        driver.refresh_from_db()
        self.assertEqual(driver.driver_profile.vehicle_type, "bike")
