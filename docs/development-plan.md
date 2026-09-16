# Development Plan

**Approach:** Build the backend first. And follow coding crew principles. 

## Backend

### 1. Project setup
- Set up the Django project with Django REST Framework and PostgreSQL, using uv for dependencies.
- Read secrets and settings from the environment (`.env`), never from code.
- Make users sign in with email from day one; this is hard to change later.

**Done when:** the project runs locally and the admin panel opens.

### 2. Data model and admin
- Build the tables in `docs/data-models.md`: Tenant, User, Customer, Route and RouteStop.
- Enforce the rules in the database: a customer code is unique per tenant, a customer is on at most one route, and stop order is unique within a route.
- Set up the admin panel so a superuser can create tenants and users and set passwords.
> Note: Use Django user and basic auth, But inherit the user and create a custom user model so that we can modify the properties of the user down the line if needed. 

**Done when:** a superuser can create a tenant and a user who can sign in.

### 3. Customer data
- Import Pricecenter's customers from the Excel file into their tenant.
- Look up map coordinates for each address through an address-lookup service, starting with Nominatim (OpenStreetMap's free service), and record whether the pin is street-level or only ZIP-level.
> Note: Put lookup services behind one common interface. Every provider takes an address and returns the same result (coordinates and accuracy), so any provider can replace another without changing the code that uses it (Liskov substitution). Adding a provider means adding one new class and switching a setting. Each provider handles its own limits, e.g. Nominatim allows one lookup per second.

**Done when:** every customer has coordinates and the counts match the Excel file.

### 4. API
- Sign in and sign out.
- Customers: list them for the map, filter by state, county and city, and search by address or ZIP code.
- Routes: create, view, edit and delete, and list all saved routes.
- Every request only returns and changes data in the user's own tenant.
- Errors come back in one consistent format.
- Automated tests for each endpoint, especially that no user can reach another tenant's data.

**Done when:** all tests pass and the API list is shared with the frontend.

## Frontend

### 5. App shell and sign-in
- Set up the React app with the Astryx UI design system.
- Sign-in page, and redirect to it when the user isn't signed in.

**Done when:** a user can sign in and sign out.

### 6. Map and routes
- Map page with customer pins, filters (state, county, city) and search (address, ZIP code).
- Build a route by selecting pins, then save it.
- Saved routes list: open, edit and delete any route in the tenant.
- Loading, empty and error states on every screen.

**Done when:** a user can do everything in `docs/core-functionality.md` in the browser.

### 7. Projects
- Add Project to the data model: every customer and route belongs to one project, and a customer code is unique per project instead of per tenant.
- Existing customers and routes move into a project named "Default" for their tenant.
- The import command takes a `--project`, so the same file can be imported into several projects.
- API: list and view projects; customers and routes are listed and created per project.
- Frontend: a Projects tab that opens a project's routes table and map.

**Done when:** a user can open a project from the Projects tab and its routes and map show only that project's data.

## Launch

## Not in this plan
- Features of the legacy tool that aren't in the core functionality: reordering stops for the shortest drive, mileage estimates, and spreadsheet export.
- Self-service password reset.
