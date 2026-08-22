from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("operations", "0007_activetrip_current_segment_index_and_more"),
    ]

    operations = [
        migrations.AlterField(
            model_name="vehicle",
            name="vehicle_type",
            field=models.CharField(
                choices=[("bike", "Bike"), ("auto", "Auto-Rickshaw")],
                max_length=20,
            ),
        ),
    ]
