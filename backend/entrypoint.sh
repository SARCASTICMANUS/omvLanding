#!/bin/sh

# 1. Wait for Database (The Fix)
echo "Waiting for database..."
while ! python -c "import socket; socket.create_connection(('db', 5432))" 2>/dev/null; do
    echo "Database not ready, waiting 1s..."
    sleep 1
done
echo "Database is ready!"

# 2. Make Migrations
echo "Making migrations..."
python manage.py makemigrations

# 3. Apply Migrations
echo "Applying migrations..."
python manage.py migrate

# 4. Create Superuser (Idempotent)
echo "Creating superuser..."
python manage.py shell -c "
from django.contrib.auth import get_user_model;
User = get_user_model();
if not User.objects.filter(username='root').exists():
    User.objects.create_superuser('root', 'root@gmail.com', 'zxcv9876')
    print('Superuser created.')
else:
    print('Superuser already exists.')
"

# 5. Start the Server
echo "Starting Server..."
exec daphne -b 0.0.0.0 -p 8000 vayy.asgi:application