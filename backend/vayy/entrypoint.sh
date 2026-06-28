#!/bin/sh

set -e

echo "Waiting for PostgreSQL..."

while ! nc -z host.docker.internal 5432; do
    sleep 2
done

echo "PostgreSQL is ready"

python manage.py makemigrations
python manage.py migrate --noinput
python manage.py collectstatic --noinput


python manage.py shell << EOF
from django.contrib.auth import get_user_model

User = get_user_model()

username = "root"
email = "root@gmail.com"
password = "zxcv9876"

if not User.objects.filter(username=username).exists():
    User.objects.create_superuser(
        username=username,
        email=email,
        password=password
    )
    print("Superuser created")
else:
    print("Superuser already exists")
EOF

echo "Starting Daphne Server..."

exec daphne \
    -b 0.0.0.0 \
    -p 8000 \
    vayy.asgi:application
