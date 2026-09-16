# API

Base URL: `http://localhost:8000/api/` (dev). All requests/responses are JSON, snake_case keys, UUIDs as strings.

## Auth

Every endpoint except login requires:

```
Authorization: Bearer <token>
```

Every request only ever returns or changes data in the caller's own tenant. An id belonging to another tenant behaves exactly like an id that doesn't exist — `404`, never `403`, never a peek at the data. The same goes for the `project` param: a project outside the caller's tenant is a `404`.

### `POST /api/auth/login/`

Request:

```json
{ "email": "planner@pricecenter.local", "password": "..." }
```

Response `200`:

```json
{
  "token": "c8aa728b94b88e5c30c0ef152fcb85653cc8bc12",
  "user": {
    "id": "e9f44967-7218-44f0-af13-cc83f999611b",
    "email": "planner@pricecenter.local",
    "name": "Pricecenter Planner",
    "tenant": { "id": "addc905a-...", "name": "Pricecenter" }
  }
}
```

Wrong email/password, an inactive user, or a user with no tenant (e.g. a superuser) all return the same `400`:

```json
{ "message": "Invalid email or password.", "extra": {} }
```

### `POST /api/auth/logout/`

No body. Deletes the caller's token. Response: `204 No Content`.

### `GET /api/auth/me/`

Response `200`: same `user` object shape as login (not wrapped).

## Projects

Customers and routes live in a project. Projects are read-only here — a superuser creates them in the admin or with the `import_customers` command.

### `GET /api/projects/`

Response `200` — array ordered by name:

```json
[
  {
    "id": "0f3a...",
    "name": "Default",
    "customer_count": 1850,
    "route_count": 12,
    "created_at": "2026-09-11T19:00:00Z",
    "updated_at": "2026-09-11T19:00:00Z"
  }
]
```

### `GET /api/projects/{id}/`

Response `200`: one project, same shape. `404` if the project doesn't exist in the caller's tenant.

## Customers

### `GET /api/customers/`

Query params (`project` required, the rest optional; all exact case-insensitive match unless noted):

| Param | Meaning |
| --- | --- |
| `project` | project id — only that project's customers are returned |
| `state` | 2-letter state code |
| `county` | county name |
| `city` | city name |
| `search` | matches address (contains) OR zipcode (starts with) |

Response `200` — a plain array (no pagination), ordered by name:

```json
[
  {
    "id": "6d2e...",
    "customer_code": "CST10005",
    "name": "Best Cellar Wine & Spirit (Summit)",
    "address": "23 Summit Avenue",
    "address2": "",
    "city": "Summit",
    "county": "Union",
    "state": "NJ",
    "zipcode": "07901",
    "latitude": 40.714487,
    "longitude": -74.35665,
    "location_accuracy": "street",
    "route": { "id": "1b5b...", "name": "Route A", "color": "#ff0000" } // or null
  }
]
```

`latitude`/`longitude`/`location_accuracy` are `null`/`""` until the customer has been geocoded. `location_accuracy` is `"street"` or `"zip"`.

### `GET /api/customers/filter-options/`

Query params: `project` (required), `state`, `county` (both optional) — narrow the returned options the way a cascading filter UI would (pick a state, get that state's counties; pick a county too, get that county's cities).

Response `200`:

```json
{ "states": ["NJ", "NY", ...], "counties": ["Union", ...], "cities": ["Summit", ...] }
```

Lists are distinct, sorted, and exclude blanks.

## Places

### `GET /api/places/search/`

Geocodes a free-text place search (for the explore map). Not tenant-scoped, no `project` param, and it doesn't touch saved customers.

Query params (all optional, but at least one must be non-blank):

| Param | Meaning |
| --- | --- |
| `state` | state name or 2-letter code |
| `county` | county name |
| `city` | city name |
| `address` | street address |

Response `200` — the best US match:

```json
{ "latitude": 40.728927, "longitude": -74.148365, "label": "12, Main Street, ..., Newark, Essex County, New Jersey, 07105, United States" }
```

Errors: `400` `Validation error` when every param is blank (`extra.fields.non_field_errors`); `404` `{"message": "No place matches that search.", "extra": {}}` when nothing matches.

## Routes

### `GET /api/routes/`

Query params: `project` (required).

Response `200` — array ordered by most recently updated first:

```json
[
  {
    "id": "1b5b...",
    "project_id": "0f3a...",
    "name": "Route A",
    "color": "#ff0000",
    "stop_count": 3,
    "created_by": { "id": "e9f4...", "name": "Pricecenter Planner", "email": "planner@pricecenter.local" },
    "created_at": "2026-09-11T19:00:00Z",
    "updated_at": "2026-09-11T19:05:00Z"
  }
]
```

`created_by` is `null` if that user was later removed.

### `GET /api/routes/{id}/`

Response `200` — list fields plus:

```json
{
  ...,
  "stops": [
    { "sequence": 1, "customer": { "id": "...", "customer_code": "...", "name": "...", "...": "(same shape as the customer list item, minus `route`)" } }
  ]
}
```

`404` if the route doesn't exist in the caller's tenant.

### `POST /api/routes/`

Request:

```json
{ "project": "0f3a...", "name": "Tuesday Loop", "color": "#3366cc", "customer_ids": ["6d2e...", "8f1a..."] }
```

`project` is the project the route belongs to; every customer must be in it. `customer_ids` is ordered — position becomes stop sequence (1-based) — and must have at least 1 entry. Response `201`: route detail (same shape as `GET /api/routes/{id}/`). `404` for a project outside the caller's tenant.

### `PATCH /api/routes/{id}/`

Request: any of `name`, `color`, `customer_ids`. Sending `customer_ids` replaces the route's stops wholesale (same ordering rule as create). A route can't move to another project — `project` is ignored. Response `200`: route detail. `404` for another tenant's route.

### `DELETE /api/routes/{id}/`

Response `204`. Stops are deleted with it; the customers on it become free again. `404` for another tenant's route.

### Business errors (route writes)

All `400` with the `{message, extra}` shape:

| Situation | `message` | `extra` |
| --- | --- | --- |
| Same id twice in `customer_ids` | `"Duplicate customers in the same route."` | `{}` |
| An id doesn't exist in the route's project (including another project's or tenant's customer) | `"Some customers were not found."` | `{"customer_ids": [...]}` |
| A customer is already on a different route | `"Some customers are already on another route."` | `{"customer_ids": [...]}` |

Route create/update is atomic — a rejected request changes nothing.

## Errors

Every error response, from any endpoint, is:

```json
{ "message": "...", "extra": {} }
```

Validation errors put field errors in `extra.fields`:

```json
{ "message": "Validation error", "extra": { "fields": { "email": ["This field is required."] } } }
```

| Status | When |
| --- | --- |
| `400` | Validation error, or a business rule from the table above |
| `401` | Missing/invalid `Authorization` header |
| `403` | Authenticated but has no tenant (shouldn't happen for normal users) |
| `404` | Not found, including any object or `project` outside the caller's tenant |
| `500` | Server error |
