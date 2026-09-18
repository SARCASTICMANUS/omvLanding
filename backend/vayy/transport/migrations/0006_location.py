from django.db import migrations, models
import django.contrib.gis.db.models.fields
import uuid


class Migration(migrations.Migration):

    dependencies = [
        ("transport", "0005_stop_plus_code_stop_nearby_landmark"),
    ]

    operations = [
        migrations.CreateModel(
            name="Location",
            fields=[
                (
                    "id",
                    models.UUIDField(
                        default=uuid.uuid4,
                        editable=False,
                        primary_key=True,
                        serialize=False,
                    ),
                ),
                (
                    "osm_id",
                    models.BigIntegerField(
                        db_index=True,
                        help_text="OpenStreetMap node/way/relation ID",
                        unique=True,
                    ),
                ),
                (
                    "name",
                    models.CharField(db_index=True, max_length=500),
                ),
                (
                    "admin_level",
                    models.PositiveIntegerField(
                        db_index=True,
                        help_text="2=country, 4=state, 6=district, 8=city, 9=suburb, 10=village",
                    ),
                ),
                (
                    "location_type",
                    models.CharField(
                        blank=True,
                        default="",
                        help_text="city, town, village, suburb, locality, hamlet, etc.",
                        max_length=50,
                    ),
                ),
                (
                    "state",
                    models.CharField(blank=True, default="", max_length=255),
                ),
                (
                    "country",
                    models.CharField(default="India", max_length=255),
                ),
                (
                    "centroid",
                    django.contrib.gis.db.models.fields.PointField(
                        blank=True, null=True, srid=4326
                    ),
                ),
                (
                    "parent",
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.SET_NULL,
                        related_name="children",
                        to="transport.location",
                    ),
                ),
                (
                    "population",
                    models.PositiveIntegerField(blank=True, null=True),
                ),
                (
                    "created_at",
                    models.DateTimeField(auto_now_add=True),
                ),
                (
                    "updated_at",
                    models.DateTimeField(auto_now=True),
                ),
            ],
            options={
                "ordering": ["admin_level", "name"],
                "indexes": [
                    models.Index(
                        fields=["admin_level"],
                        name="transport_lo_admin_l_idx",
                    ),
                    models.Index(
                        fields=["location_type"],
                        name="transport_lo_locatio_idx",
                    ),
                    models.Index(
                        fields=["state", "name"],
                        name="transport_lo_state_na_idx",
                    ),
                ],
            },
        ),
    ]
