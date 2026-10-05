"""Isolated local testing settings; never connects to the application's database."""
import os
from pathlib import Path

# Supply harmless values before loading the shared settings, which validate env vars.
for key, value in {
    "DJANGO_SECRET_KEY": "local-e2e-only",
    "DB_HOST": "unused",
    "DB_PORT": "5432",
    "DB_NAME": "unused",
    "DB_USER": "unused",
    "DB_PASSWORD": "unused",
    "GEOCODER_CLASS": "api.customers.geocoders.NominatimGeocoder",
    "NOMINATIM_URL": "http://127.0.0.1:9",
    "NOMINATIM_USER_AGENT": "route-e2e",
    "SSO_ENABLED": "false",
}.items():
    os.environ[key] = value

from config.settings.django_configs import *  # noqa: E402,F403

DEBUG = True
ALLOWED_HOSTS = ["127.0.0.1", "localhost", "testserver"]
DATABASES = {
    "default": {
        "ENGINE": "django.db.backends.sqlite3",
        "NAME": Path(__file__).resolve().parents[3] / "frontend" / ".e2e" / "backend.sqlite3",
    }
}
TASKS = {"default": {"BACKEND": "django_tasks.backends.dummy.DummyBackend"}}
PASSWORD_HASHERS = ["django.contrib.auth.hashers.MD5PasswordHasher"]
# Historical data migrations contain PostgreSQL-only SQL. Build current app
# model tables directly for the disposable SQLite harness; production is unchanged.
MIGRATION_MODULES = {name: None for name in ["accounts", "projects", "customers", "routes"]}
