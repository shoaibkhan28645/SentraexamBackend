# Sentraexam Backend

Backend API for the Sentraexam academic management platform built with Django, Django REST Framework, and PostgreSQL.

## Features

- Role-based access for Administrators, Heads of Department, Teachers, and Students.
- Department, course, timetable, assessment, assignment, and notification management.
- JWT authentication with refresh token rotation and token blacklisting.
- Celery-powered async jobs and Redis-based websockets/event support (hooks ready).
- API schema generation with OpenAPI 3 via drf-spectacular.

## Getting Started

```bash
cp .env.example .env
docker-compose up --build
```

Once containers are running, apply migrations and create an admin user:

```bash
docker-compose exec web python manage.py migrate
docker-compose exec web python manage.py createsuperuser
```

API documentation is available at `http://localhost:8000/api/docs/`.

## Running Tests

```bash
pytest
```

## Project Structure

- `apps/users`: Custom user model, authentication flows, role management.
- `apps/departments`: Department, course allocation, timetable ownership.
- `apps/courses`: Course catalog, enrollment relationships.
- `apps/assessments`: Exams, assignments, grading workflows.
- `apps/notifications`: Announcements, inbox, delivery tracking.
- `apps/documents`: Secure academic document storage.
- `apps/academic_calendar`: Institutional calendars and events.

## Tooling

- Formatting with Black and isort.
- Type checking with mypy.
- Pre-commit hooks ready via `.pre-commit-config.yaml` (add as needed).
