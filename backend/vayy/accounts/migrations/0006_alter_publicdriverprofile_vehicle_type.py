from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("accounts", "0005_alter_publicdriverprofile_vehicle_type"),
    ]

    operations = [
        migrations.AlterField(
            model_name="publicdriverprofile",
            name="vehicle_type",
            field=models.CharField(
                choices=[("bike", "Bike"), ("auto", "Auto-Rickshaw")],
                default="auto",
                max_length=20,
            ),
        ),
    ]
