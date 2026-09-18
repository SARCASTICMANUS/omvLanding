# syntax=docker/dockerfile:1
FROM python:3.12-slim

# Pass via build ARG for the target architecture.
# x86_64  -> /usr/lib/x86_64-linux-gnu/libgdal.so
# arm64   -> /usr/lib/aarch64-linux-gnu/libgdal.so
# NOTE: GDAL/GEOS paths are auto-detected by Django at runtime (settings.py).
# Do not hardcode an arch-specific path here or in .env - it breaks the other arch.
# ARG TARGETARCH=arm64
# ARG GDAL_SO=/usr/lib/${TARGETARCH}-linux-gnu/libgdal.so

ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1
# ENV GDAL_LIBRARY_PATH=${GDAL_SO}
# ENV GEOS_LIBRARY_PATH=/usr/lib/${TARGETARCH}-linux-gnu/libgeos_c.so

WORKDIR /app

# System dependencies for Django + GDAL/PostGIS
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    gcc \
    g++ \
    binutils \
    libproj-dev \
    proj-data \
    proj-bin \
    gdal-bin \
    libgdal-dev \
    libgeos-dev \
    libpq-dev \
    postgresql-client \
    curl \
    netcat-openbsd \
    gosu \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir --timeout 300 --retries 5 -i https://pypi.org/simple/ -r requirements.txt \
    && python -c "import django.core.management; assert hasattr(django.core.management, 'execute_from_command_line'); import daphne, celery"

COPY . .

RUN mkdir -p /app/staticfiles /app/media

# Non-root runtime user (privileges dropped via gosu in entrypoint)
RUN useradd --create-home --uid 1000 vayy \
    && chown -R vayy:vayy /app
COPY --chown=vayy:vayy entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

EXPOSE 8000

# Daphne: ASGI server (HTTP + WebSockets) - run as non-root
CMD ["/entrypoint.sh"]