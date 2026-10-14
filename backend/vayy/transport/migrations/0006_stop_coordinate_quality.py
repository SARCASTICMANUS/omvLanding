from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [("transport", "0005_city_admin_configuration")]

    operations = [
        migrations.AddField(
            model_name="stop", name="coordinate_status",
            field=models.CharField(choices=[("verified", "Verified"), ("provisional", "Provisional"), ("conflict", "Conflict"), ("unresolved", "Unresolved"), ("legacy_synthetic", "Legacy synthetic")], default="verified", max_length=24),
        ),
        migrations.AddField(
            model_name="stop", name="aliases",
            field=models.JSONField(blank=True, default=list),
        ),
        migrations.AddField(
            model_name="stop", name="serviceability_reason",
            field=models.CharField(blank=True, default="", max_length=255),
        ),
    ]
