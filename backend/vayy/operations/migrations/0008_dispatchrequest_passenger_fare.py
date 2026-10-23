from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("operations", "0007_active_fare_configuration_constraint"),
    ]

    operations = [
        migrations.AddField(
            model_name="dispatchrequest",
            name="passenger_fare",
            field=models.DecimalField(blank=True, decimal_places=2, max_digits=10, null=True),
        ),
    ]
