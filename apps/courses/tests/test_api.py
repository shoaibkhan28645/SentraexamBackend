import pytest
from rest_framework.test import APIClient

from apps.users.models import User
from tests.factories import CourseFactory, UserFactory


@pytest.mark.django_db
def test_teacher_sees_assigned_courses():
    teacher = UserFactory(role=User.Role.TEACHER)
    course = CourseFactory(assigned_teacher=teacher)
    client = APIClient()
    client.force_authenticate(user=teacher)

    response = client.get("/api/courses/")
    assert response.status_code == 200
    data = response.json()
    if isinstance(data, dict) and "results" in data:
        payload = data["results"]
    else:
        payload = data
    course_ids = [item["id"] for item in payload]
    assert str(course.id) in course_ids
