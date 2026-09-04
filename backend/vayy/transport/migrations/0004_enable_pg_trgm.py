from django.contrib.postgres.operations import TrigramExtension
from django.db import migrations


class Migration(migrations.Migration):

    dependencies = [
        ("transport", "0003_rename_bus_number_to_route_code"),
    ]

    operations = [
        TrigramExtension(),
    ]
