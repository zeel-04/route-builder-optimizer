# Customer assignment visibility

## Development plan

1. Add tenant- and project-scoped assignment summaries. Apply table assignment filters before pagination; calculate counts before assignment filters and return both search-matching and project totals.
2. Add shared All / Assigned / Unassigned count buttons with accessible pressed states. Preserve search and reset pagination when changing assignment filters.
3. Add a Route column with route links, color dots, and an Unassigned status.
4. Calculate map counts from the unsaved route draft. Treat removed stops as unassigned; retain the current route on the map when filtering. Preserve route colors during search and add assignment labels to markers and tooltips.
5. Label filtered versus project totals and explain unassigned customers without a map location. Show Unsaved changes until a successful save.

## Verification plan

- Run backend assignment tests and the existing API/service suite against an isolated SQLite test database.
- Run TypeScript, ESLint, and the production frontend build.
- Run Playwright against the real Next.js and Django apps, using deterministic disposable data: 58 customers, two routes, missing and approximate locations, multiple geographic groups, plus fully assigned, empty, and foreign-tenant projects.
- Verify totals across pagination; search combined with assignment filters; page reset, invalid page redirects, reload and history; route links; empty states; live add/remove counts; duplicate additions; other-route protection; successful saves and saved-table consistency; new-route creation; failed saves; geographic scoping; and mobile controls.
- Capture desktop and mobile screenshots, inspect them visually, and retain a Playwright HTML report and failure traces/videos.

## Running locally

From `frontend/`, run `pnpm exec playwright install chromium`, then `pnpm test:e2e`.
The runner starts Django on port 8001 and Next.js on port 3001. Install backend dependencies with `uv sync` first. It uses `config.settings.e2e` and the disposable `frontend/.e2e/backend.sqlite3`; it never connects to the normal application database. Each run reseeds this disposable database. Tests run serially and restore route assignments before each case.

Screenshots and traces are saved in `frontend/test-results/`; the HTML report is in `frontend/playwright-report/`. These generated files are ignored by Git.

SQLite covers API contracts and application behavior. The harness builds current app model tables directly because historical data migrations use PostgreSQL-only SQL. Migration execution, PostgreSQL-specific concurrency/locking, and live geocoder behavior require the normal backend test configuration and are outside this UI change's browser verification.

## Verification results — 2026-10-05

- Playwright: **13 passed**, using the real local frontend and API; no uncaught browser errors. Covers counts, pagination, search, history, draft add/remove, saves, conflicts, unpinned customers, zero-match states, mobile layout, keyboard filters, and tenant isolation.
- Backend: **202 passed**, with 4 live geocoder tests excluded, using `.venv/bin/python -m pytest tests/ --ds=config.settings.e2e` from `backend/`.
- Frontend: production build, TypeScript, ESLint, and `git diff --check` passed.
- Captured **13 named screenshots**, in addition to each test's completion screenshot. Reviewed desktop and mobile layouts, assignment statuses, draft indicators, and loaded maps. Screenshot capture waits for map initialization, tiles to load, and tile fade animations to finish.
- Visual verification fixed narrow mobile columns and kept the desktop Actions column visible. Browser checks also fixed stale marker assignment labels and duplicate desktop/mobile builder rendering.

Artifacts:

- [Playwright HTML report](../frontend/playwright-report/index.html)
- [Desktop map](../frontend/test-results/customer-assignments-map-d-a6da0-urrent-route-when-filtering-chromium/map-desktop.png)
- [Mobile map](../frontend/test-results/customer-assignments-mobil-4708b-ounts-and-actions-reachable-chromium/map-mobile.png)
- [Desktop customer table](../frontend/test-results/customer-assignments-table-19c2c-nt-changes-reset-pagination-chromium/customers-assigned.png)
- [Mobile route assignments](../frontend/test-results/customer-assignments-mobil-4708b-ounts-and-actions-reachable-chromium/customers-mobile-routes.png)

Generated artifacts are local and ignored by Git; a new test run replaces them. No normal application data was modified.
