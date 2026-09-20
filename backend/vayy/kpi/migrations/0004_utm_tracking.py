from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("kpi", "0003_pageview_geo_enrichment"),
    ]

    operations = [
        migrations.AddField(
            model_name="pageview",
            name="utm_source",
            field=models.CharField(blank=True, default="", max_length=100),
        ),
        migrations.AddField(
            model_name="pageview",
            name="utm_medium",
            field=models.CharField(blank=True, default="", max_length=100),
        ),
        migrations.AddField(
            model_name="pageview",
            name="utm_campaign",
            field=models.CharField(blank=True, default="", max_length=255),
        ),
        migrations.AddField(
            model_name="pageview",
            name="utm_term",
            field=models.CharField(blank=True, default="", max_length=255),
        ),
        migrations.AddField(
            model_name="pageview",
            name="utm_content",
            field=models.CharField(blank=True, default="", max_length=255),
        ),
        migrations.AddIndex(
            model_name="pageview",
            index=models.Index(fields=["utm_source"], name="kpi_pv_utm_src_idx"),
        ),
    ]
