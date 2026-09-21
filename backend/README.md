# Route Builder Backend

Django + DRF + PostgreSQL, managed with `uv`. See `../docs/api.md` for the API contract.

## Setup

```
uv sync
```

Copy `.env.example` to `.env` and fill in every value (DB credentials, `DJANGO_SECRET_KEY`, Nominatim settings). `DB_HOST`/`DB_PORT` point at Supabase's **transaction pooler** for the app; tests automatically use the session pooler (port 5432) instead — see the comment in `config/settings/database.py`.

```
uv run python manage.py migrate
uv run python manage.py runserver
```

Admin panel: `http://localhost:8000/admin/`.

## Env vars

See `.env.example` for the full list: `DB_*` (Postgres), `DJANGO_SECRET_KEY`/`DJANGO_DEBUG`/`DJANGO_ALLOWED_HOSTS`, and `NOMINATIM_URL`/`NOMINATIM_USER_AGENT`/`GEOCODER_CLASS` (address lookup).

## Tests

```
uv run pytest tests/
```

Data-driven — cases live as JSON under `tests/test_data/<app>/*.json`, one parametrized test drives all of them (see `tests/conftest.py`). Uses `--reuse-db` (set in `pyproject.toml`) since Supabase's pooler makes dropping the test DB on every run flaky; run `uv run pytest --create-db` once after a migration change to force a rebuild.

## Customer import & geocoding

```
uv run python manage.py import_customers path/to/file.xlsx --tenant "Pricecenter" --project "Default"
uv run python manage.py geocode_customers --tenant "Pricecenter" [--limit N]
```

Import upserts by `(project, customer_code)` and creates the project in the tenant if it doesn't exist yet; the same file imported into two projects gives two independent sets of customers. A customer whose address changes loses its coordinates so the next geocode run picks it up again. Geocoding only looks at customers with no coordinates yet (never-tried first, past failures last), saves as it goes, and can simply be re-run if interrupted. Each address goes to Nominatim first (with any trailing suite/unit dropped), then to the free US Census geocoder if the street isn't found, and only then falls back to the ZIP code's centre (`location_accuracy="zip"`). It calls Nominatim at 1 request/second, so a full run of ~1,850 customers takes 30–60 minutes — run it with `nohup ... &` for a full pass.

Add a new address-lookup provider by writing one class implementing `Geocoder.geocode()` (see `api/customers/geocoders.py`) and pointing `GEOCODER_CLASS` at it.
