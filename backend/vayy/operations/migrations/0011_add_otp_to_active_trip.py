from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('operations', '0010_rename_operations_d_status_idx_operations__status_84c216_idx_and_more'),
    ]

    operations = [
        migrations.AddField(
            model_name='activetrip',
            name='otp',
            field=models.CharField(
                blank=True,
                help_text='4-digit OTP for passenger-driver handshake verification',
                max_length=4,
                null=True,
            ),
        ),
    ]
