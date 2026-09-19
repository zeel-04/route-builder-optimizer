# Production deploy

```
push to main ──► GitHub Actions ──► Docker Hub (sjenterprise/global:route-builder-<sha>)
                       │
                       └─ ssh ──► EC2 (us-east-1, t3a.small, Ubuntu)
                                   └─ docker compose
                                        ├─ caddy    :80/:443, automatic Let's Encrypt TLS
                                        └─ backend  gunicorn :8000 (compose-internal only)

push to main ──► Amplify (SSR) ──► https://route-builder.sjenterpriseusa.com
                                        └─ server-side fetch ─► https://api.route-builder.sjenterpriseusa.com/api
```

Postgres is Supabase. There is no database, cache, or worker on the box.

## Backend

`.github/workflows/deploy-backend.yml` runs on pushes to `main` that touch `backend/`, `deploy/`, or the
workflow itself (or manually via *Run workflow*). It builds the image, copies this directory to
`~/app/deploy` on the instance, writes `~/app/deploy/.env` from the repository's Actions secrets, runs
`docker compose pull && docker compose up -d`, then polls `/healthz/` over HTTPS and fails if it never
answers.

The container runs `collectstatic` on start and serves static files itself (WhiteNoise). TLS and the
domain live in `Caddyfile`; certificates persist in the `caddy_data` volume.

### Migrations are manual

The container never migrates. When a release carries migrations, apply them yourself after the deploy:

```
ssh -i ~/.ssh/route-builder.pem ubuntu@<EC2_HOST>
cd ~/app/deploy
docker compose run --rm --entrypoint python backend manage.py showmigrations | grep '\[ \]'
docker compose run --rm --entrypoint python backend manage.py migrate
```

Other management commands run the same way, e.g. the long geocoding pass:

```
nohup docker compose run --rm --entrypoint python backend manage.py geocode_customers > geocode.log 2>&1 &
```

### Secrets

Repository-level Actions secrets (Settings → Secrets and variables → Actions):

| Secret | Notes |
|---|---|
| `DOCKERHUB_USERNAME`, `DOCKERHUB_TOKEN` | account with push access to `sjenterprise/global` |
| `EC2_HOST`, `EC2_USER`, `EC2_SSH_KEY` | Elastic IP, `ubuntu`, private key of the `route-builder` key pair |
| `DJANGO_SECRET_KEY` | |
| `DJANGO_ALLOWED_HOSTS` | `api.route-builder.sjenterpriseusa.com` |
| `DJANGO_CSRF_TRUSTED_ORIGINS` | `https://api.route-builder.sjenterpriseusa.com` |
| `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASSWORD` | Supabase transaction pooler |
| `NOMINATIM_URL`, `NOMINATIM_USER_AGENT`, `GEOCODER_CLASS` | required at boot |
| `SSO_ENABLED`, `OIDC_DISCOVERY_URL`, `OIDC_CLIENT_ID` | must match the frontend |

An unset secret is written as an empty value, and the backend refuses to boot on a missing required
variable. To load them in bulk, fill `deploy/.secrets.production` (gitignored; template in
`.secrets.production.example`).

### Rollback

Every deploy is pinned to a sha tag, so rolling back is re-pointing `IMAGE`:

```
cd ~/app/deploy
sed -i 's|^IMAGE=.*|IMAGE=sjenterprise/global:route-builder-<old-sha>|' .env
docker compose pull backend && docker compose up -d backend
```

Migrations are not reversed by this.

### Day-2

```
docker compose ps
docker compose logs -f backend
docker compose logs -f caddy
```

## Frontend

Amplify app `route-builder-optimizer` (WEB_COMPUTE) builds `main` with the root `amplify.yml`
(`appRoot: frontend`, Node 22, pnpm 11.9.0). Environment variables are set on the Amplify app:
`API_URL`, `APP_URL`, `SSO_ENABLED`, `OIDC_DISCOVERY_URL`, `OIDC_CLIENT_ID`, `OIDC_CLIENT_SECRET`.

Authentik must have these registered for the application:

- Redirect URI: `https://route-builder.sjenterpriseusa.com/api/auth/callback/authentik`
- Post-logout redirect URI: `https://route-builder.sjenterpriseusa.com/login`

Users are never auto-created: each SSO user must already exist (active, with a tenant) in the Django
admin at `https://api.route-builder.sjenterpriseusa.com/admin/`.

## DNS

Managed outside AWS.

- `api.route-builder` — `A` record to the instance's Elastic IP
- `route-builder` — `CNAME` to the CloudFront target Amplify shows under Domain management, plus its
  certificate-validation `CNAME`
