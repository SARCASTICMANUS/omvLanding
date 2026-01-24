# FROM python:3.10-slim

# # Install geospatial libraries (GDAL/GEOS) required for GeoDjango
# RUN apt-get update && apt-get install -y \
#     binutils \
#     libproj-dev \
#     gdal-bin \
#     libgdal-dev \
#     python3-gdal \
#     && rm -rf /var/lib/apt/lists/*

# WORKDIR /app

# COPY requirements.txt .
# RUN pip install --no-cache-dir -r requirements.txt

# COPY . .

# # We wait for the DB to be ready in the entrypoint or compose
# # CMD ["daphne", "-b", "0.0.0.0", "-p", "8000", "vayy.asgi:application"]
# CMD ["python", "manage.py", "runserver", "0.0.0.0:8000"]

# FROM python:3.10-slim

# # Prevent Python from buffering stdout and stderr
# ENV PYTHONUNBUFFERED=1

# # Install geospatial libraries (GDAL/GEOS) required for GeoDjango
# RUN apt-get update && apt-get install -y \
#     binutils \
#     libproj-dev \
#     gdal-bin \
#     libgdal-dev \
#     python3-gdal \
#     && rm -rf /var/lib/apt/lists/*

# WORKDIR /app

# COPY requirements.txt .
# RUN pip install --no-cache-dir -r requirements.txt

# COPY . .

# # We default to daphne for best WebSocket support, but can be overridden
# CMD ["daphne", "-b", "0.0.0.0", "-p", "8000", "vayy.asgi:application"]

FROM python:3.10-slim

ENV PYTHONUNBUFFERED=1

# Install GDAL/Geos
RUN apt-get update && apt-get install -y \
    binutils \
    libproj-dev \
    gdal-bin \
    libgdal-dev \
    python3-gdal \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

# Copy entrypoint and make it executable
COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

# Set the entrypoint
ENTRYPOINT ["/entrypoint.sh"]