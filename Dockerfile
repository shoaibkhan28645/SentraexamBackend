FROM python:3.12-slim AS base

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1

WORKDIR /app

# Install Python dependencies first for better layer caching
COPY requirements/base.txt requirements/prod.txt ./requirements/
RUN python -m pip install --upgrade pip \
    && pip install -r requirements/prod.txt

# Copy application source
COPY . .

# Default to gunicorn for prod images; compose overrides with runserver for dev
CMD ["gunicorn", "config.wsgi:application", "--bind", "0.0.0.0:8000"]
