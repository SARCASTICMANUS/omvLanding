import logging
from datetime import timedelta

from django.core.management.base import BaseCommand
from django.utils import timezone

from tracking.models import HybridLog

logger = logging.getLogger(__name__)


class Command(BaseCommand):
    help = (
        "Retention job for HybridLog: delete rows older than --days (default 7). "
        "Run periodically (e.g. Celery Beat / cron) to keep the high-write "
        "location table bounded."
    )

    def add_arguments(self, parser):
        parser.add_argument(
            "--days",
            type=int,
            default=7,
            help="Delete HybridLog rows older than this many days (default: 7).",
        )
        parser.add_argument(
            "--batch",
            type=int,
            default=5000,
            help="Rows deleted per batch to limit lock hold time (default: 5000).",
        )

    def handle(self, *args, **options):
        days = options["days"]
        batch = options["batch"]
        cutoff = timezone.now() - timedelta(days=days)
        qs = HybridLog.objects.filter(timestamp__lt=cutoff).only("id")

        deleted = 0
        while True:
            ids = list(qs.values_list("id", flat=True)[:batch])
            if not ids:
                break
            n, _ = HybridLog.objects.filter(id__in=ids).delete()
            deleted += n
            self.stdout.write(f"Deleted {deleted} rows so far...")

        self.stdout.write(
            self.style.SUCCESS(
                f"Retention complete: deleted {deleted} HybridLog rows older than {days} days."
            )
        )