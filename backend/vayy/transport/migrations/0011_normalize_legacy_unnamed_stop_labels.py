import re
from collections import defaultdict

from django.db import migrations


LEGACY_NAME = re.compile(r"^Unnamed stop \((.+)\)$", re.IGNORECASE)


def normalize_legacy_unnamed_stop_labels(apps, schema_editor):
    Stop = apps.get_model("transport", "Stop")
    database = schema_editor.connection.alias
    groups = defaultdict(lambda: {"existing": set(), "legacy": []})

    rows = Stop.objects.using(database).order_by("city_id", "route_id", "order", "pk")
    for stop in rows.values("pk", "city_id", "route_id", "source_stop_id", "name").iterator(chunk_size=2000):
        group_key = ("route", stop["route_id"]) if stop["route_id"] else (
            ("city", stop["city_id"]) if stop["city_id"] else ("stop", stop["pk"])
        )
        group = groups[group_key]
        name = str(stop["name"] or "").strip()
        match = LEGACY_NAME.fullmatch(name)
        source_id = str(stop["source_stop_id"] or "").strip()
        if match and source_id and match.group(1).casefold() == source_id.casefold():
            group["legacy"].append(stop["pk"])
        else:
            group["existing"].add(name.casefold())

    for group in groups.values():
        legacy_ids = group["legacy"]
        occupied = group["existing"]
        for index, stop_id in enumerate(legacy_ids, start=1):
            label = "Nearest OMV Stop" if len(legacy_ids) == 1 else f"OMV Stop {index}"
            suffix = index
            while label.casefold() in occupied:
                label = f"OMV Stop {suffix}"
                suffix += 1
            occupied.add(label.casefold())
            Stop.objects.using(database).filter(pk=stop_id).update(name=label)


class Migration(migrations.Migration):
    dependencies = [
        ("transport", "0010_name_unnamed_stops"),
    ]

    operations = [
        migrations.RunPython(normalize_legacy_unnamed_stop_labels, migrations.RunPython.noop),
    ]
