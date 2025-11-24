from django.db import migrations


class Migration(migrations.Migration):

    dependencies = [
        ("assessments", "0003_assessment_content_fields"),
    ]

    operations = [
        migrations.RunSQL(
            sql='ALTER TABLE "assessments_assessment" DROP COLUMN IF EXISTS "exam_url";',
            reverse_sql='ALTER TABLE "assessments_assessment" ADD COLUMN "exam_url" varchar(200);',
        ),
    ]
