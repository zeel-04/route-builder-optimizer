# Pricecenter Route Builder — Executive Summary

**In one line:** A web app where planners build delivery or sales routes by picking customer stores on a map.

Pricecenter serves about 1,850 customer stores (liquor stores, gas stations, convenience shops), mostly in New York and the Northeast. The app is multi-tenant: each tenant has its own users, customers and routes, and never sees another tenant's data.

Planners see their tenant's stores as pins on a map, filter them by state, county or city, and search by address or ZIP code. They click stores to build a route. Every saved route is shared across the tenant, so any user can reopen, edit or delete it. For now, a superuser creates tenants and user accounts in the admin panel; users sign in with an email and password and can't reset it themselves.

It replaces the legacy Route Builder, a single web page that ran on one computer: saved routes stayed in that browser only, and the customer list was built into the page, so new customers needed a new version of the file.
