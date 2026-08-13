#!/bin/sh
set -e

# Derive the Postgres host/port from DATABASE_URL (e.g. postgis://user:pass@db:5432/vayy)
DB_HOST=$(echo "$DATABASE_URL" | sed -E 's#.*@([^:/]+).*#\1#')
DB_PORT=$(echo "$DATABASE_URL" | sed -E 's#.*@[^:/]+:([0-9]+).*#\1#')
DB_PORT=${DB_PORT:-5432}
DB_USER=$(echo "$DATABASE_URL" | sed -E 's#postgis://([^:]+):.*#\1#')
DB_PASSWORD=$(echo "$DATABASE_URL" | sed -E 's#postgis://[^:]+:([^@]+)@.*#\1#')
DB_NAME=$(echo "$DATABASE_URL" | sed -E 's#.*/([^/?]+).*#\1#')

echo "Waiting for PostgreSQL at $DB_HOST:$DB_PORT..."
until nc -z "$DB_HOST" "$DB_PORT"; do
  sleep 2
done
echo "PostgreSQL is ready"

# Migrations are committed to the repo and must be tracked - run migrate only.
# Ensure PostGIS extension exists (PostGIS image does not enable it by default).
if command -v psql >/dev/null 2>&1; then
  PGPASSWORD="$DB_PASSWORD" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -c "CREATE EXTENSION IF NOT EXISTS postgis;" || true
fi
python manage.py migrate --noinput
python manage.py collectstatic --noinput

# Create admin superuser from env (idempotent, non-interactive)
if [ -n "$DJANGO_SUPERUSER_USERNAME" ]; then
  python manage.py shell << EOF
from django.contrib.auth import get_user_model
import os
User = get_user_model()
username = os.environ.get("DJANGO_SUPERUSER_USERNAME", "root")
email = os.environ.get("DJANGO_SUPERUSER_EMAIL", "")
password = os.environ.get("DJANGO_SUPERUSER_PASSWORD", "")
if username and password and not User.objects.filter(username=username).exists():
    User.objects.create_superuser(username=username, email=email, password=password)
    print("Superuser ready")
else:
    print("Superuser already exists")
EOF
fi

echo "Starting Daphne Server..."
exec gosu vayy daphne \
    -b 0.0.0.0 \
    -p 8000 \
    vayy.asgi:application