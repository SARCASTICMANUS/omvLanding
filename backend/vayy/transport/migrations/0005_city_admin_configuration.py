# Add durable admin metadata for city routing and fare settings.
from django.db import migrations, models
import django.db.models.deletion
from django.utils.text import slugify


def populate_city_slugs(apps, schema_editor):
    City = apps.get_model("transport", "City")
    used = set()
    for city in City.objects.all().order_by("name", "id"):
        base = slugify(city.name) or "city"
        slug = base
        suffix = 2
        while slug in used:
            slug = f"{base}-{suffix}"
            suffix += 1
        used.add(slug)
        city.slug = slug
        city.save(update_fields=["slug"])


class Migration(migrations.Migration):
    dependencies = [("transport", "0004_global_stops")]

    operations = [
        migrations.AddField(
            model_name="city",
            name="slug",
            # SlugField defaults to db_index=True. Defer index creation until
            # the final AlterField below so PostgreSQL doesn't create the
            # varchar pattern index twice during this migration.
            field=models.SlugField(blank=True, db_index=False, default="", max_length=255),
            preserve_default=False,
        ),
        migrations.RunPython(populate_city_slugs, migrations.RunPython.noop),
        migrations.AlterField(
            model_name="city",
            name="slug",
            field=models.SlugField(blank=True, max_length=255, unique=True),
        ),
        migrations.CreateModel(
            name="CityAdminConfiguration",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("currency", models.CharField(default="INR", max_length=3)),
                ("fare_per_km", models.DecimalField(decimal_places=2, default=8, max_digits=10)),
                ("platform_fee", models.DecimalField(decimal_places=2, default=0, max_digits=10)),
                ("rounding_rule", models.CharField(choices=[("none", "None"), ("nearest_unit", "Nearest whole rupee"), ("ceil_unit", "Round up to whole rupee"), ("floor_unit", "Round down to whole rupee")], default="none", max_length=20)),
                ("corridor_m", models.PositiveIntegerField(default=100)),
                ("max_walk_to_stop_m", models.PositiveIntegerField(default=1200)),
                ("is_active", models.BooleanField(default=True)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                ("city", models.OneToOneField(on_delete=django.db.models.deletion.CASCADE, related_name="admin_configuration", to="transport.city")),
            ],
        ),
    ]
