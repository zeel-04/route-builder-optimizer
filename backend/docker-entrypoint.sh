#!/bin/sh
set -e

# Migrations run in the deploy workflow, before this container is replaced —
# not here, where every gunicorn restart would race to apply them.
python manage.py collectstatic --noinput

exec gunicorn config.wsgi:application \
  --bind 0.0.0.0:8000 \
  --workers "${GUNICORN_WORKERS:-2}" \
  --threads "${GUNICORN_THREADS:-2}" \
  --timeout "${GUNICORN_TIMEOUT:-120}" \
  --access-logfile - \
  --error-logfile -
