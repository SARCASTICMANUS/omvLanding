"""
Bound the broadcast dispatch expiry cascade.

The cascade re-dispatched and re-scheduled itself on every tick with nothing
recording that it had run, so a request that kept finding idle drivers
re-notified them every 45 seconds forever. attempt_count/max_rounds make the
budget explicit and persisted, so termination is a property of the data rather
than of luck.

dismissed_drivers records driver-initiated dismissals, which used to be a
logged no-op. Without it the cascade's fallback stage, which consulted no
exclusion set, re-notified exactly the drivers who had already dismissed.

All three are additive with defaults, so existing rows keep working: an
in-flight request starts at attempt_count=0 with the default budget and an
empty dismissal list.
"""

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("operations", "0002_activetrip_partially_settled_status"),
    ]

    operations = [
        migrations.AddField(
            model_name="dispatchrequest",
            name="dismissed_drivers",
            field=models.JSONField(
                default=list,
                help_text="Driver IDs who dismissed this broadcast; never re-notified",
            ),
        ),
        migrations.AddField(
            model_name="dispatchrequest",
            name="attempt_count",
            field=models.PositiveIntegerField(
                default=0,
                help_text="Expiry cascade rounds already spent on this request",
            ),
        ),
        migrations.AddField(
            model_name="dispatchrequest",
            name="max_rounds",
            field=models.PositiveIntegerField(
                default=3,
                help_text="Maximum expiry cascade rounds before the request is expired",
            ),
        ),
    ]
