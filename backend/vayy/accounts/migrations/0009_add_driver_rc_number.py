from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("accounts", "0008_add_driver_dob_gender_bank_detail"),
    ]

    operations = [
        migrations.AddField(
            model_name="publicdriverprofile",
            name="rc_number",
            field=models.CharField(
                max_length=50,
                default="",
                blank=True,
            ),
        ),
    ]
