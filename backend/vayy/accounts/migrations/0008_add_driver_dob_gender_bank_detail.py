from django.db import migrations, models
import uuid


class Migration(migrations.Migration):

    dependencies = [
        ("accounts", "0007_user_push_token"),
    ]

    operations = [
        migrations.AddField(
            model_name="publicdriverprofile",
            name="dob",
            field=models.DateField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name="publicdriverprofile",
            name="gender",
            field=models.CharField(blank=True, default="", max_length=20),
        ),
        migrations.CreateModel(
            name="DriverBankDetail",
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
                ("holder_name", models.CharField(blank=True, default="", max_length=255)),
                ("account_number", models.CharField(blank=True, default="", max_length=50)),
                ("ifsc", models.CharField(blank=True, default="", max_length=20)),
                ("upi", models.CharField(blank=True, default="", max_length=100)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                (
                    "driver",
                    models.OneToOneField(
                        on_delete=models.CASCADE,
                        related_name="bank_detail",
                        to="accounts.user",
                    ),
                ),
            ],
            options={
                "verbose_name": "Driver Bank Detail",
                "verbose_name_plural": "Driver Bank Details",
            },
        ),
    ]
