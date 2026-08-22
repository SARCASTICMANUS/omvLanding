import django.contrib.gis.db.models.fields
import django.db.models.deletion
import uuid
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('transport', '0001_initial'),
        ('operations', '0003_triprating'),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name='Dispatch',
            fields=[
                ('id', models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ('vehicle_type', models.CharField(choices=[('bus', 'Bus'), ('van', 'Van'), ('minibus', 'Minibus'), ('car', 'Car'), ('auto', 'Auto-Rickshaw'), ('tempo', 'Tempo Traveller'), ('bike', 'Bike')], default='bike', max_length=20)),
                ('status', models.CharField(choices=[('searching', 'Searching'), ('accepted', 'Accepted'), ('arrived', 'Arrived'), ('active', 'Active'), ('completed', 'Completed'), ('cancelled', 'Cancelled')], db_index=True, default='searching', max_length=20)),
                ('is_hand_raised', models.BooleanField(default=True, help_text='False when passenger lowers hand')),
                ('pickup_lat', models.FloatField(default=0)),
                ('pickup_lon', models.FloatField(default=0)),
                ('dest_lat', models.FloatField(default=0)),
                ('dest_lon', models.FloatField(default=0)),
                ('fare', models.FloatField(default=0, help_text='Estimated fare for this segment')),
                ('route_segment', django.contrib.gis.db.models.fields.LineStringField(blank=True, geography=True, help_text='GeoJSON LineString from pickup to destination along the route', null=True, srid=4326)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('passenger', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='dispatches', to=settings.AUTH_USER_MODEL)),
                ('pickup_stop', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='pickup_dispatches', to='transport.stop')),
                ('destination_stop', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='destination_dispatches', to='transport.stop')),
                ('driver_route', models.ForeignKey(blank=True, help_text="The driver's full route (set when driver books)", null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='dispatches', to='transport.route')),
                ('vehicle', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='dispatches', to='operations.vehicle')),
                ('driver', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='driver_dispatches', to=settings.AUTH_USER_MODEL)),
            ],
            options={
                'ordering': ['-created_at'],
                'indexes': [
                    models.Index(fields=['status', 'created_at'], name='dispatch_status_created_idx'),
                    models.Index(fields=['passenger', 'status'], name='dispatch_passenger_status_idx'),
                    models.Index(fields=['driver', 'status'], name='dispatch_driver_status_idx'),
                    models.Index(fields=['vehicle_type', 'status'], name='dispatch_vehicle_type_status_idx'),
                ],
            },
        ),
    ]
