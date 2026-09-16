# Route Builder Frontend

Next.js (App Router) + Astryx UI + react-leaflet. All backend calls run on the server; the browser never sees the API URL or the token.

## Setup

```
pnpm install
cp .env.example .env.local   # API_URL points at the Django backend
pnpm dev                     # http://localhost:3000
```

Sign in with a user the superuser created in the Django admin (`../backend`).

## Layout

```
app/
  login/            sign-in page (public)
  (app)/            everything behind sign-in: map (/) and routes (/routes)
components/         screen components (map, route builder, routes table)
lib/
  client.ts         server-only fetch wrapper: token, base URL, Zod validation, error shape
  dal.ts            verifySession() — reads the session cookie, redirects to /login
  features/<name>/  schema.ts (Zod) → types.ts → api.ts ('use server' reads + actions)
proxy.ts            optimistic redirect to /login when the cookie is missing
```

Filters (`state`, `county`, `city`, `search`) and the open route (`route`) live in the URL. The unsaved route draft is local state in the map screen.

## Astryx

Run `pnpm exec astryx component <Name>` for any component's props before using it. Theme: `@astryxdesign/theme-neutral`, wired in `app/providers.tsx`.
