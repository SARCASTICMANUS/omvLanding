# Register Celery app so it's loaded when Django starts (if celery is installed)
try:
    from .celery import app as celery_app
    __all__ = ("celery_app",)
except ImportError:
    # Celery not installed — tasks won't work but Django will run fine
    pass
