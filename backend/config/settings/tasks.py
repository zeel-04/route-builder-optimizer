# Background work goes through Django's Tasks API. Queued tasks are rows in the
# main database and `manage.py db_worker` runs them, so there is no broker.
# django_tasks is the backport of django.tasks; on Django 6 it becomes an
# import rename.
TASKS = {
    "default": {
        "BACKEND": "django_tasks_db.DatabaseBackend",
        "QUEUES": ["default"],
    }
}
