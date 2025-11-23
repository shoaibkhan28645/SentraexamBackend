from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("assessments", "0003_assessment_content_fields"),
    ]

    operations = [
        migrations.AddField(
            model_name="assessment",
            name="questions",
            field=models.JSONField(blank=True, default=list),
        ),
        migrations.AddField(
            model_name="assessmentsubmission",
            name="answers",
            field=models.JSONField(blank=True, default=list),
        ),
    ]
