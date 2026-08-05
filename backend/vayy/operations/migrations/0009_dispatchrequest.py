import django.db.models.deletion
import uuid
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("operations", "0008_alter_vehicle_vehicle_type"),
        ("transport", "0001_initial"),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name="DispatchRequest",
            fields=[
                (
                    "id",
                    models.UUIDField(
                        default=uuid.uuid4,
                        editable=False,
                        primary_key=True,
                        serialize=False,
                    ),
                ),
                (
                    "status",
                    models.CharField(
                        choices=[
                            ("pending", "Pending"),
                            ("accepted", "Accepted"),
                            ("cancelled", "Cancelled"),
                            ("expired", "Expired"),
                        ],
                        db_index=True,
                        default="pending",
                        max_length=20,
                    ),
                ),
                (
                    "notified_drivers",
                    models.JSONField(
                        default=list,
                        help_text="List of driver IDs who received the broadcast",
                    ),
                ),
                ("pickup_lat", models.FloatField(blank=True, null=True)),
                ("pickup_lng", models.FloatField(blank=True, null=True)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("expires_at", models.DateTimeField()),
                (
                    "accepted_by",
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.SET_NULL,
                        related_name="accepted_dispatches",
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
                (
                    "passenger",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="dispatch_requests",
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
                (
                    "pickup_stop",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="dispatch_requests",
                        to="transport.stop",
                    ),
                ),
                (
                    "route",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="dispatch_requests",
                        to="transport.route",
                    ),
                ),
            ],
            options={
                "ordering": ["-created_at"],
                "indexes": [
                    models.Index(
                        fields=["status", "created_at"],
                        name="operations_d_status_idx",
                    ),
                    models.Index(
                        fields=["route", "status"],
                        name="operations_d_route_s_idx",
                    ),
                ],
            },
        ),
    ]
