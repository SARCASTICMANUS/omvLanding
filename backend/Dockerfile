# FROM python:3.10-slim

# ENV PYTHONUNBUFFERED=1

# # Install GDAL/Geos
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

# # Copy entrypoint and make it executable
# COPY entrypoint.sh /entrypoint.sh
# RUN chmod +x /entrypoint.sh

# # Set the entrypoint
# ENTRYPOINT ["/entrypoint.sh"]

FROM python:3.11-slim

# Prevent Python from buffering stdout/stderr and writing .pyc files
ENV PYTHONUNBUFFERED=1
ENV PYTHONDONTWRITEBYTECODE=1

WORKDIR /app

# Install standard PostgreSQL client libraries (required for psycopg2)
RUN apt-get update && apt-get install -y \
    binutils \
    libproj-dev \
    gdal-bin \
    libgdal-dev \
    python3-gdal \
    && rm -rf /var/lib/apt/lists/*

# Install Python requirements
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy backend source code (Context is the backend folder)
COPY . .

# 1. Run Migrations
# 2. Collect Static files (for Admin panel/WhiteNoise)
# 3. Start Daphne ASGI server
# CMD sh -c "python manage.py migrate --noinput && \
#            python manage.py collectstatic --noinput && \
#            daphne -b 0.0.0.0 -p 8000 vayy.asgi:application" 
CMD sh -c "python manage.py makemigrations && \
           python manage.py migrate --noinput && \
           python manage.py collectstatic --noinput && \
           daphne -b 0.0.0.0 -p 8000 vayy.asgi:application"