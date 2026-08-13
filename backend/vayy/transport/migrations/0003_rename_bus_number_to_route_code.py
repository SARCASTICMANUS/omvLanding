from django.db import migrations


class Migration(migrations.Migration):

    dependencies = [
        ("transport", "0002_stop_cumulative_distance_m_and_more"),
    ]

    operations = [
        migrations.RenameField(
            model_name="route",
            old_name="bus_number",
            new_name="route_code",
        ),
    ]
