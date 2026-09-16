# Core Functionality

Users only see and change data that belongs to their own tenant.

## Projects

- A tenant has one or more projects. Every customer and route belongs to exactly one project.
- The same customer can be imported into several projects; each copy is its own row and can be on its own route.
- The Projects tab lists the tenant's projects. Opening one shows that project's routes and its map.
- Projects are created by a superuser, in the admin panel or by the customer import.

## Routes

- **Create:** A user builds a route by selecting customer pins on the map. The map shows only the customers in the current project.
- **Edit and delete:** A user can edit or delete any route in their tenant.
- **Filter:** A user can filter the pins by state, county and city.
- **Search:** A user can search for a customer by address or ZIP code.
- **View saved routes:** A user can see every route saved in a project, including routes other users created.

## Tenants and users

- **Setup:** For now, a superuser creates tenants and users in the admin panel and assigns each user to one tenant.
- **Sign in:** A user signs in with an email and password, both set by the superuser.
- **Passwords:** Users can't reset or change their own password yet. Only a superuser can set a new one.
