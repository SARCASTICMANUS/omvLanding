"""
Introduce admin-managed global stops.

Stops were route-owned only: ``Stop.route`` was NOT NULL and ``(route, order)``
was uniquely constrained, so a boarding point could not exist without being
positioned on a registered fixed route. The journey flow matches a driver's
free-form path against admin stops, which are by definition not on any route.

``route`` becomes nullable and ``(route, order)`` unique only where a route is
present, so route stops keep their per-route ordering guarantee while global
stops (all sharing ``order=0``) no longer collide. ``is_global`` mirrors the
null state so callers can query either without remembering the convention, and
``city`` gives a global stop an owner without forcing a Route.

The Route table itself is untouched and stays in use for the legacy flow.
"""

from django.db import migrations, models
import django.db.models.deletion
from django.db.models import Q


class Migration(migrations.Migration):

    dependencies = [
        ("transport", "0003_stop_transport_stop_name_fts"),
    ]

    operations = [
        migrations.AlterField(
            model_name="stop",
            name="route",
            field=models.ForeignKey(
                blank=True,
                help_text="NULL for admin-created global stops.",
                null=True,
                on_delete=django.db.models.deletion.CASCADE,
                related_name="stops",
                to="transport.route",
            ),
        ),
        migrations.AlterField(
            model_name="stop",
            name="order",
            field=models.PositiveIntegerField(
                default=0,
                help_text="Position on the route for route stops; unused for global stops.",
            ),
        ),
        migrations.AddField(
            model_name="stop",
            name="city",
            field=models.ForeignKey(
                blank=True,
                help_text="Owning city for global stops; optional for route stops.",
                null=True,
                on_delete=django.db.models.deletion.CASCADE,
                related_name="stops",
                to="transport.city",
            ),
        ),
        migrations.AddField(
            model_name="stop",
            name="is_global",
            field=models.BooleanField(
                default=False,
                help_text="Admin-managed stop not attached to a route.",
            ),
        ),
        # is_global needs no backfill: every pre-existing row has a route, and
        # False is both the field default and the correct value for them.
        migrations.AlterUniqueTogether(
            name="stop",
            unique_together=set(),
        ),
        migrations.AddConstraint(
            model_name="stop",
            constraint=models.UniqueConstraint(
                condition=Q(route__isnull=False),
                fields=("route", "order"),
                name="transport_stop_route_order_unique",
            ),
        ),
    ]
