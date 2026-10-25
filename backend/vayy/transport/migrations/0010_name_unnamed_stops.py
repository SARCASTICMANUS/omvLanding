from collections import defaultdict

from django.db import migrations
from django.db.models.functions import Trim


def name_unnamed_stops(apps, schema_editor):
    Stop = apps.get_model("transport", "Stop")
    database = schema_editor.connection.alias
    unnamed = Stop.objects.using(database).annotate(
        trimmed_name=Trim("name"),
    ).filter(trimmed_name="").order_by("city_id", "route_id", "order", "pk")

    groups = defaultdict(list)
    for stop in unnamed.iterator():
        group = ("route", stop.route_id) if stop.route_id else (
            ("city", stop.city_id) if stop.city_id else ("stop", stop.pk)
        )
        groups[group].append(stop)

    for stops in groups.values():
        for index, stop in enumerate(stops, start=1):
            stop.name = "Nearest OMV Stop" if len(stops) == 1 else f"OMV Stop {index}"
            stop.save(update_fields=["name"], using=database)


class Migration(migrations.Migration):
    dependencies = [
        ("transport", "0009_walk_to_stop_default_3000m"),
    ]

    operations = [
        migrations.RunPython(name_unnamed_stops, migrations.RunPython.noop),
    ]
