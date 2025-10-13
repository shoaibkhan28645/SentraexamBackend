import pytest
from rest_framework.test import APIClient

from tests.factories import AssessmentFactory, CourseEnrollmentFactory, UserFactory


@pytest.mark.django_db
def test_student_can_submit_assessment():
    enrollment = CourseEnrollmentFactory()
    assessment = AssessmentFactory(course=enrollment.course)
    assessment.status = assessment.Status.APPROVED
    assessment.save()
    student = enrollment.student
    client = APIClient()
    client.force_authenticate(user=student)

    payload = {"assessment": str(assessment.id)}
    response = client.post("/api/assessments/submissions/", payload, format="json")
    assert response.status_code == 201
