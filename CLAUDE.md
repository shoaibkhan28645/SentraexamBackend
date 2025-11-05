# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Sentraexam is a Django-based academic management platform with role-based access control. The system supports Administrators, Heads of Department (HOD), Teachers, and Students with JWT authentication.

## Development Commands

### Docker Environment (Recommended)

```bash
# Start all services
docker-compose up --build

# Apply migrations
docker-compose exec web python manage.py migrate

# Create superuser
docker-compose exec web python manage.py createsuperuser

# Run commands in container
docker-compose exec web python manage.py <command>
```

### Local Development

```bash
# Run development server
make run
# or: python manage.py runserver

# Database migrations
make migrate
make makemigrations

# Run tests
make test
# or: pytest
# Run specific test file: pytest apps/assessments/tests/test_api.py

# Code formatting
make format  # Runs black and isort

# Type checking and linting
make lint  # Runs flake8 and mypy
```

## Architecture

### Settings Configuration

Settings are split by environment in `config/settings/`:
- `base.py` - Shared settings
- `dev.py` - Development overrides
- `prod.py` - Production settings
- `test.py` - Test configuration

Set `DJANGO_SETTINGS_MODULE` env var to select (defaults to `config.settings.base`).

### Custom User Model

The project uses a custom User model (`apps.users.User`) with email-based authentication instead of username. All user references should use `settings.AUTH_USER_MODEL` or `get_user_model()`.

User roles: `ADMIN`, `HOD`, `TEACHER`, `STUDENT`

### Base Model Hierarchy

All models inherit from abstract bases in `apps/common/models.py`:
- `TimeStampedModel` - Adds `created_at` and `updated_at` timestamps
- `UUIDModel` - Uses UUID primary keys instead of integer IDs
- `BaseModel` - Combines both UUID and timestamps
- `OwnedModel` - Extends `BaseModel` with `created_by` and `updated_by` user references

### App Structure

The project follows Django's app-based architecture:

- `apps/users` - Custom user model, authentication (JWT with refresh token rotation), activation tokens, password reset
- `apps/departments` - Department management and user-department memberships with role assignments
- `apps/courses` - Course catalog, enrollment, approval workflow (draft → pending → approved → active)
- `apps/assessments` - Exams, quizzes, assignments with submission and grading workflows
- `apps/notifications` - Announcements (targeted by audience), notifications, delivery tracking
- `apps/documents` - Secure academic document storage
- `apps/academic_calendar` - Academic years, terms, and institutional events
- `apps/common` - Shared base models and utilities

### Authentication & Permissions

Uses Django REST Framework with JWT (SimpleJWT):
- Access tokens expire in 30 minutes
- Refresh tokens expire in 7 days with rotation enabled
- Blacklisting enabled after rotation

Custom permission classes in `apps/users/permissions.py`:
- `IsAdmin` - Admin role only
- `IsAdminOrHOD` - Admin or HOD roles
- `IsSelfAdminOrDepartmentHead` - User can access own data, admins can access all, HODs can access their department

Object-level permissions use django-guardian.

### API Documentation

OpenAPI schema generation via drf-spectacular:
- Schema endpoint: `/api/schema/`
- Swagger UI: `/api/docs/`
- ReDoc: `/api/redoc/`

All API routes are prefixed with `/api/` and organized by app.

### Async Tasks & Caching

- Celery configured with Redis broker
- Redis also available for caching and real-time features
- Celery app defined in `config/celery.py`

### Testing

- Test configuration in `pyproject.toml` uses `config.settings.test`
- Factory classes in `tests/factories.py` using factory_boy
- App-specific tests in `apps/<app_name>/tests/`
- Run with pytest: `pytest` or `make test`

### Code Quality

- Black formatter (line length: 100, excludes migrations)
- isort for import sorting (black-compatible profile)
- flake8 for linting
- mypy for type checking
- Pre-commit hooks configured in `.pre-commit-config.yaml`

### Model Workflows

**Assessment Lifecycle:**
1. Created as `DRAFT` by teacher
2. `submit_for_approval()` → `SUBMITTED`
3. `approve(user)` → `APPROVED` (by HOD/Admin)
4. `schedule(scheduled_at, closes_at)` → `SCHEDULED`
5. Auto-transitions to `IN_PROGRESS` and `COMPLETED` based on timing

**Course Lifecycle:**
`DRAFT` → `PENDING_APPROVAL` → `ACTIVE` or `ARCHIVED`

**User Activation:**
New users are inactive by default. Create `ActivationToken` with `ActivationToken.create_for_user(user)` and send to user. Token validates and activates account.

## Key Patterns

- All models use UUID primary keys, not integers
- Timestamps are automatic on all models inheriting from `TimeStampedModel`
- Use `select_related()` and `prefetch_related()` in querysets for foreign keys (see `UserViewSet` for examples)
- ViewSets use `get_queryset()` to filter based on user role
- Model methods handle state transitions (e.g., `assessment.approve(user)`)
- Structured logging configured via structlog
