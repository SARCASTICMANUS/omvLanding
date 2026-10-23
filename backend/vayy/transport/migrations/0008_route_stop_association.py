import uuid

import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("transport", "0007_route_direction_name_route_route_geometry_id_and_more"),
    ]

    operations = [
        migrations.CreateModel(
            name="RouteStopAssociation",
            fields=[
                ("id", models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ("order", models.PositiveIntegerField()),
                ("boarding_allowed", models.BooleanField(default=True)),
                ("alighting_allowed", models.BooleanField(default=True)),
                ("route", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="route_stop_associations", to="transport.route")),
                ("stop", models.ForeignKey(on_delete=django.db.models.deletion.PROTECT, related_name="route_memberships", to="transport.stop")),
            ],
            options={"ordering": ["order"]},
        ),
        migrations.AddConstraint(
            model_name="routestopassociation",
            constraint=models.UniqueConstraint(fields=("route", "order"), name="transport_route_stop_association_order_unique"),
        ),
    ]
