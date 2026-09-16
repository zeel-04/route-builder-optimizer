import sys

from config.env import env, validate_env

REQUIRED_ENV_VARS = ["DB_HOST", "DB_PORT", "DB_NAME", "DB_USER", "DB_PASSWORD"]
validate_env(REQUIRED_ENV_VARS)

# ponytail: pytest's CREATE/DROP DATABASE for the test DB needs a real
# session — Supabase's transaction pooler (port 6543) keeps its own idle
# backend on the test DB and blocks the DROP at teardown. The session
# pooler (same host, port 5432) doesn't have that problem; app runtime
# keeps using the transaction pooler via DB_PORT.
_port = "5432" if "pytest" in sys.modules else env("DB_PORT")

DATABASES = {
    "default": {
        "ENGINE": "django.db.backends.postgresql",
        "HOST": env("DB_HOST"),
        "PORT": _port,
        "NAME": env("DB_NAME"),
        "USER": env("DB_USER"),
        "PASSWORD": env("DB_PASSWORD"),
        # ponytail: Supabase's transaction pooler doesn't support persistent
        # server-side state — no pooled connections, no server-side cursors.
        "CONN_MAX_AGE": 0,
        "DISABLE_SERVER_SIDE_CURSORS": True,
    }
}
