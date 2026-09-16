import environ
from django.core.exceptions import ImproperlyConfigured

env = environ.Env()


def validate_env(required: list[str]) -> None:
    missing = [name for name in required if env(name, default=None) in (None, "")]
    if missing:
        raise ImproperlyConfigured(f"Missing required env vars: {', '.join(missing)}")
