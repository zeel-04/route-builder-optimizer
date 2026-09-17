# Route Builder

Django + DRF API (`backend/`) and a Next.js app (`frontend/`) for building delivery routes off a customer map. Postgres lives on Supabase — neither side runs a database locally.

Details per side: [`backend/README.md`](backend/README.md), [`frontend/README.md`](frontend/README.md). Docs in [`docs/`](docs).

## Dev

One-time:

```
cd backend  && uv sync && cp .env.example .env       # fill in DB_*, DJANGO_SECRET_KEY
uv run python manage.py migrate
cd ../frontend && pnpm install && cp .env.example .env.local
```

Then, from the repo root:

```
make dev        # backend on :8000, frontend on :3000 — Ctrl-C stops both
```

`make backend` / `make frontend` run one side on its own.

## Production

Backend — the image takes the same env vars as `.env`, with `DJANGO_DEBUG=false` and a real `DJANGO_ALLOWED_HOSTS`:

```
docker build -t route-backend backend
docker run -p 8000:8000 --env-file backend/.env route-backend
```

It serves gunicorn on port 8000. Run `manage.py migrate` against the production database on deploy; the container does not migrate on boot.

Frontend — a standard Next.js server, with `API_URL` pointing at the backend:

```
cd frontend && pnpm install && pnpm build && pnpm start
```

Put TLS and a domain in front of both. Single sign-on is off unless `SSO_ENABLED=true` is set on both sides (see either `.env.example`).
