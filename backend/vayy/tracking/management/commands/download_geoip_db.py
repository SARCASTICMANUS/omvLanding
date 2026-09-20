import os
import sys
import gzip
import shutil
import logging

import requests
from django.conf import settings
from django.core.management.base import BaseCommand

logger = logging.getLogger(__name__)

GEOIP_URL = "https://cdn.jsdelivr.net/npm/geolite2-city/GeoLite2-City.mmdb.gz"


class Command(BaseCommand):
    help = "Download GeoLite2-City.mmdb from MaxMind (no license key required)"

    def handle(self, *args, **options):
        mmdb_path = settings.GEOIP_MMDB_PATH

        if os.path.isfile(mmdb_path):
            self.stdout.write(f"GeoIP DB already exists at {mmdb_path}")
            return

        os.makedirs(os.path.dirname(mmdb_path) or ".", exist_ok=True)

        self.stdout.write("Downloading GeoLite2-City.mmdb.gz from MaxMind...")
        try:
            resp = requests.get(GEOIP_URL, timeout=120)
            resp.raise_for_status()

            gz_path = mmdb_path + ".gz"
            with open(gz_path, "wb") as f:
                f.write(resp.content)

            with gzip.open(gz_path, "rb") as f_in, open(mmdb_path, "wb") as f_out:
                shutil.copyfileobj(f_in, f_out)

            os.remove(gz_path)
            self.stdout.write(self.style.SUCCESS(f"GeoIP DB downloaded to {mmdb_path}"))
        except Exception as e:
            self.stderr.write(self.style.ERROR(f"GeoIP DB download failed: {e}"))
            sys.exit(1)
