from django.db import migrations


class Migration(migrations.Migration):

    dependencies = [
        ("transport", "0006_location"),
    ]

    operations = [
        migrations.DeleteModel(name="Location"),
    ]
