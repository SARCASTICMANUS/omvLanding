from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("accounts", "0001_initial"),
    ]

    operations = [
        migrations.AddField(
            model_name="driverdocument",
            name="doc_key",
            field=models.CharField(
                blank=True,
                default="",
                help_text="Unique slot key (e.g. dlFront, rcBack) for create-or-update",
                max_length=50,
            ),
        ),
        migrations.AddIndex(
            model_name="driverdocument",
            index=models.Index(
                fields=["driver", "doc_key"],
                name="accounts_dri_driver__idx",
            ),
        ),
    ]
