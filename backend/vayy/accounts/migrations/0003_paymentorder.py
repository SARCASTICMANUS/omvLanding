import uuid

import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("accounts", "0002_add_doc_key_to_driver_document"),
    ]

    operations = [
        migrations.CreateModel(
            name="PaymentOrder",
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
                    "order_id",
                    models.CharField(
                        editable=False,
                        max_length=64,
                        unique=True,
                    ),
                ),
                (
                    "idempotency_key",
                    models.CharField(max_length=128, unique=True),
                ),
                (
                    "amount",
                    models.DecimalField(decimal_places=2, max_digits=12),
                ),
                ("currency", models.CharField(default="INR", max_length=10)),
                (
                    "status",
                    models.CharField(
                        choices=[
                            ("pending", "Pending"),
                            ("processing", "Processing"),
                            ("succeeded", "Succeeded"),
                            ("failed", "Failed"),
                        ],
                        db_index=True,
                        default="pending",
                        max_length=20,
                    ),
                ),
                (
                    "gateway",
                    models.CharField(blank=True, max_length=50, null=True),
                ),
                (
                    "gateway_payment_id",
                    models.CharField(blank=True, max_length=128, null=True),
                ),
                (
                    "gateway_signature",
                    models.CharField(blank=True, max_length=256, null=True),
                ),
                (
                    "failure_reason",
                    models.CharField(blank=True, max_length=255, null=True),
                ),
                (
                    "metadata",
                    models.JSONField(blank=True, default=dict),
                ),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                ("paid_at", models.DateTimeField(blank=True, null=True)),
                (
                    "user",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="payment_orders",
                        to="accounts.user",
                    ),
                ),
                (
                    "wallet_transaction",
                    models.OneToOneField(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.SET_NULL,
                        related_name="payment_order",
                        to="accounts.transaction",
                    ),
                ),
            ],
            options={
                "ordering": ["-created_at"],
            },
        ),
        migrations.AddIndex(
            model_name="paymentorder",
            index=models.Index(
                fields=["status", "created_at"],
                name="accounts_pa_status_fb399f_idx",
            ),
        ),
        migrations.AddIndex(
            model_name="paymentorder",
            index=models.Index(
                fields=["user", "status"],
                name="accounts_pa_user_id_42e0e5_idx",
            ),
        ),
        migrations.AddConstraint(
            model_name="paymentorder",
            constraint=models.UniqueConstraint(
                condition=models.Q(("gateway_payment_id__isnull", False)),
                fields=("gateway", "gateway_payment_id"),
                name="accounts_paymentorder_gateway_payment_uniq",
            ),
        ),
        migrations.AddConstraint(
            model_name="paymentorder",
            constraint=models.CheckConstraint(
                condition=models.Q(("amount__gt", 0)),
                name="accounts_paymentorder_amount_positive",
            ),
        ),
    ]
