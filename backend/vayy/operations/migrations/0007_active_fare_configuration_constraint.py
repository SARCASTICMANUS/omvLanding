from django.db import migrations, models
from django.db.models import Q


class Migration(migrations.Migration):
    dependencies = [("operations", "0006_boarding_request_segment_fare")]

    operations = [
        migrations.AlterUniqueTogether(
            name="fareconfiguration",
            unique_together=set(),
        ),
        migrations.AddConstraint(
            model_name="fareconfiguration",
            constraint=models.UniqueConstraint(
                fields=("vehicle_type",),
                condition=Q(is_active=True),
                name="unique_active_fare_per_vehicle_type",
            ),
        ),
    ]
