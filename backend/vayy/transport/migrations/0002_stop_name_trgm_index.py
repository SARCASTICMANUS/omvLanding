from django.contrib.postgres.indexes import GinIndex
from django.contrib.postgres.operations import TrigramExtension
from django.db import migrations


class Migration(migrations.Migration):

    dependencies = [
        ("transport", "0001_initial"),
    ]

    operations = [
        TrigramExtension(),
        migrations.AddIndex(
            model_name="stop",
            index=GinIndex(
                fields=["name"],
                name="transport_stop_name_trgm",
                opclasses=["gin_trgm_ops"],
            ),
        ),
    ]
