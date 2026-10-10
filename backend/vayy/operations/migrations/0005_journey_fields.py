"""
Add free-form journey support to ActiveTrip and BoardingRequest.

A driver may now declare origin -> destination instead of picking a registered
route. ``ActiveTrip.route`` becomes nullable for that case and the durable
endpoints are recorded on the trip; the road path and the ordered global stops
along it are held in Redis for the life of the journey (see
tracking.services.journey_cache_service), because they are large, short-lived
and derived.

A journey is shared, so one trip carries many passengers. The safety code
therefore moves onto ``BoardingRequest``: with a per-passenger boarding the
trip-level ``ActiveTrip.otp`` could only ever describe one of them. It is left
in place, still written by the legacy per-trip accept path.

``DispatchRequest.route`` becomes nullable for the same reason a journey has
no route: a request raised at a global stop is scoped by that stop and the
journeys passing it, not by a route.

Every field is additive or a widening, so the legacy route flow is unaffected.
"""

from django.db import migrations, models
import django.db.models.deletion
import django.contrib.gis.db.models.fields


class Migration(migrations.Migration):

    dependencies = [
        ("operations", "0004_fareconfiguration"),
    ]

    operations = [
        migrations.AlterField(
            model_name="activetrip",
            name="route",
            field=models.ForeignKey(
                blank=True,
                help_text="NULL for a free-form journey (no fixed route).",
                null=True,
                on_delete=django.db.models.deletion.CASCADE,
                related_name="active_trips",
                to="transport.route",
            ),
        ),
        migrations.AlterField(
            model_name="activetrip",
            name="direction",
            field=models.CharField(
                choices=[
                    ("outbound", "Outbound (first→last)"),
                    ("inbound", "Inbound (last→first)"),
                ],
                db_index=True,
                default="outbound",
                help_text="Route-direction sense; meaningless for journeys.",
                max_length=10,
            ),
        ),
        migrations.AddField(
            model_name="activetrip",
            name="origin_point",
            field=django.contrib.gis.db.models.fields.PointField(
                blank=True,
                geography=True,
                help_text="Journey start (driver-declared). NULL for route trips.",
                null=True,
                srid=4326,
            ),
        ),
        migrations.AddField(
            model_name="activetrip",
            name="destination_point",
            field=django.contrib.gis.db.models.fields.PointField(
                blank=True,
                geography=True,
                help_text="Journey end (driver-declared). NULL for route trips.",
                null=True,
                srid=4326,
            ),
        ),
        migrations.AddField(
            model_name="activetrip",
            name="origin_name",
            field=models.CharField(blank=True, default="", max_length=255),
        ),
        migrations.AddField(
            model_name="activetrip",
            name="destination_name",
            field=models.CharField(blank=True, default="", max_length=255),
        ),
        migrations.AlterField(
            model_name="dispatchrequest",
            name="route",
            field=models.ForeignKey(
                blank=True,
                help_text="NULL for a journey-scoped request (pickup by global stop).",
                null=True,
                on_delete=django.db.models.deletion.CASCADE,
                related_name="dispatch_requests",
                to="transport.route",
            ),
        ),
        migrations.AddField(
            model_name="boardingrequest",
            name="otp",
            field=models.CharField(
                blank=True,
                help_text=(
                    "4-digit safety code for this boarding. Lives here rather than on "
                    "the trip because a journey serves many passengers at once."
                ),
                max_length=4,
                null=True,
            ),
        ),
    ]
