from django.db import migrations


MATERIALIZED_VIEW_SQL = """
CREATE MATERIALIZED VIEW IF NOT EXISTS mv_daily_page_stats AS
SELECT
    date(created_at)            AS day,
    platform,
    page,
    device_type,
    country,
    COUNT(*)                    AS total_views,
    COUNT(DISTINCT visitor_id)  AS unique_visitors
FROM kpi_pageview
GROUP BY
    date(created_at),
    platform,
    page,
    device_type,
    country
WITH DATA;
"""

MATERIALIZED_VIEW_INDEX_SQL = """
CREATE UNIQUE INDEX IF NOT EXISTS idx_mv_daily_page_stats_unique
    ON mv_daily_page_stats (day, platform, page, device_type, country);
"""

MATERIALIZED_VIEW_DROP_SQL = """
DROP MATERIALIZED VIEW IF EXISTS mv_daily_page_stats;
"""


class Migration(migrations.Migration):

    dependencies = [
        ("kpi", "0001_initial"),
    ]

    operations = [
        migrations.RunSQL(
            sql=MATERIALIZED_VIEW_SQL + MATERIALIZED_VIEW_INDEX_SQL,
            reverse_sql=MATERIALIZED_VIEW_DROP_SQL,
        ),
    ]
