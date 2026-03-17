# VAYY | vayy/celery.py | Status: 🆕 Created
# Reason: Missing entirely — required for Celery task system.

import os
from celery import Celery

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "vayy.settings")

app = Celery("vayy")
app.config_from_object("django.conf:settings", namespace="CELERY")
app.autodiscover_tasks()


@app.task(bind=True)
def debug_task(self):
    print(f"Request: {self.request!r}")
