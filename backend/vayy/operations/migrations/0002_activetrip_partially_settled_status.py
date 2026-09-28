"""
Introduce the partially_settled trip status.

A trip whose completion left one or more passenger debits outstanding is no
longer cleanly "completed", but it is also not running any more - the vehicle
has been released and ended_at is set. Recording it as completed was what made
the lost revenue invisible; this status is the durable signal that settlement
is still owed, and DispatchService.update_trip_status promotes it back to
completed once the retries succeed.

Purely a choices change, so this is an AlterField - no column is added and no
existing row is rewritten.
"""

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("operations", "0001_initial"),
    ]

    operations = [
        migrations.AlterField(
            model_name="activetrip",
            name="status",
            field=models.CharField(
                choices=[
                    ("requested", "Requested"),
                    ("assigned", "Assigned"),
                    ("accepted", "Accepted"),
                    ("rejected", "Rejected"),
                    ("arrived", "Arrived"),
                    ("active", "Active"),
                    ("completed", "Completed"),
                    ("partially_settled", "Partially Settled"),
                    ("cancelled", "Cancelled"),
                ],
                db_index=True,
                default="active",
                max_length=20,
            ),
        ),
    ]
