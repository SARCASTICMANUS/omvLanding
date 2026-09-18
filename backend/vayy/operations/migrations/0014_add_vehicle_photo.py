from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("operations", "0013_vehicle_status"),
    ]

    operations = [
        migrations.AddField(
            model_name="vehicle",
            name="vehicle_photo",
            field=models.TextField(
                blank=True,
                default="",
                help_text="Base64-encoded vehicle photo",
            ),
        ),
    ]
