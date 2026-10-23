from django.db import migrations, models


def raise_old_default(apps, schema_editor):
    config = apps.get_model("transport", "CityAdminConfiguration")
    config.objects.filter(max_walk_to_stop_m=1200).update(max_walk_to_stop_m=3000)


class Migration(migrations.Migration):

    dependencies = [
        ("transport", "0008_route_stop_association"),
    ]

    operations = [
        migrations.AlterField(
            model_name="cityadminconfiguration",
            name="max_walk_to_stop_m",
            field=models.PositiveIntegerField(default=3000),
        ),
        migrations.RunPython(raise_old_default, migrations.RunPython.noop),
    ]
