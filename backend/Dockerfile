FROM python:3.11-slim

# Prevent Python from buffering stdout/stderr and writing .pyc files
ENV PYTHONUNBUFFERED=1
ENV PYTHONDONTWRITEBYTECODE=1

WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y \
    build-essential \
    binutils \
    libpq-dev \
    gdal-bin \
    libgdal-dev \
    libproj-dev \
    proj-data \
    proj-bin \
    libgeos-dev \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Fix shared library paths for GeoDjango
# This finds the libraries regardless of the CPU architecture (x86 or ARM/Mac M1)
RUN ln -s /usr/lib/$(uname -m)-linux-gnu/libgdal.so /usr/lib/libgdal.so && \
    ln -s /usr/lib/$(uname -m)-linux-gnu/libgeos_c.so /usr/lib/libgeos_c.so

# Set environment variables for Django to find the libraries
ENV GEOS_LIBRARY_PATH=/usr/lib/libgeos_c.so
ENV GDAL_LIBRARY_PATH=/usr/lib/libgdal.so

# Install Python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy project code
COPY . .

# Run Django app
CMD sh -c "python manage.py makemigrations --noinput && \
    python manage.py migrate --noinput && \
    python manage.py collectstatic --noinput && \
    daphne -b 0.0.0.0 -p 8000 vayy.asgi:application"