from django.db import migrations


class Migration(migrations.Migration):

    dependencies = [
        ("transport", "0003_rename_bus_number_to_route_code"),
    ]

    operations = [
        migrations.RunSQL(
            sql="CREATE EXTENSION IF NOT EXISTS pg_trgm;",
            reverse_sql="DROP EXTENSION IF EXISTS pg_trgm;",
        ),
    ]
