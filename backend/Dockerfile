# syntax=docker/dockerfile:1
FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential gcc g++ binutils \
    libproj-dev proj-data proj-bin gdal-bin libgdal-dev libgeos-dev \
    libpq-dev postgresql-client curl netcat-openbsd gosu \
    && rm -rf /var/lib/apt/lists/*

COPY vayy/requirements.txt /tmp/requirements.txt
RUN pip install --timeout 300 --retries 5 -r /tmp/requirements.txt \
    && python -c "import django.core.management; import daphne, celery"

COPY vayy/ /app/
RUN mkdir -p /app/staticfiles /app/media /app/geoip \
    && useradd --create-home --uid 1000 vayy \
    && sed -i 's/\r$//' /app/entrypoint.sh \
    && chown -R vayy:vayy /app \
    && chmod 755 /app/entrypoint.sh

EXPOSE 8000
CMD ["sh", "/app/entrypoint.sh"]
