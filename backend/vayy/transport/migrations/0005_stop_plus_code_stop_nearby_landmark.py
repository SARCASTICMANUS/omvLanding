from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("transport", "0004_enable_pg_trgm"),
    ]

    operations = [
        migrations.AddField(
            model_name="stop",
            name="plus_code",
            field=models.CharField(
                blank=True,
                help_text="Plus code (e.g. PVJ3+Q55 Lucknow)",
                max_length=100,
            ),
        ),
        migrations.AddField(
            model_name="stop",
            name="nearby_landmark",
            field=models.CharField(
                blank=True,
                help_text="Nearby landmark name",
                max_length=255,
            ),
        ),
    ]
