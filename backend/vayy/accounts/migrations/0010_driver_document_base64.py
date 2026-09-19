from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("accounts", "0009_add_driver_rc_number"),
    ]

    operations = [
        migrations.AddField(
            model_name="driverdocument",
            name="file_data",
            field=models.TextField(
                default="",
                blank=True,
                help_text="Base64-encoded file content",
            ),
        ),
        migrations.AddField(
            model_name="driverdocument",
            name="file_name",
            field=models.CharField(
                max_length=255,
                default="upload.jpg",
            ),
        ),
        migrations.RemoveField(
            model_name="driverdocument",
            name="file",
        ),
    ]
