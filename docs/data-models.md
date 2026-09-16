# Route builder Data Model

```mermaid
erDiagram
    Tenant {
        UUID id PK
        string name
        datetime createdAt
        datetime updatedAt
    }

    User {
        UUID id PK
        UUID tenantId FK
        string email UK
        string name
        datetime createdAt
        datetime updatedAt
    }

    Project {
        UUID id PK
        UUID tenantId FK
        string name
        datetime createdAt
        datetime updatedAt
    }

    Customer {
        UUID id PK
        UUID tenantId FK
        UUID projectId FK
        string customerCode
        string name
        string address
        string address2
        string city
        string county
        string state
        string zipcode
        decimal latitude
        decimal longitude
        string locationAccuracy
        datetime createdAt
        datetime updatedAt
    }

    Route {
        UUID id PK
        UUID tenantId FK
        UUID projectId FK
        string name
        string color
        UUID createdById FK
        datetime createdAt
        datetime updatedAt
    }

    RouteStop {
        UUID id PK
        UUID routeId FK
        UUID customerId FK
        int sequence
        datetime createdAt
    }

    %% Project: unique(tenantId, name)
    %% Customer.locationAccuracy: street | zip
    %% Customer: unique(projectId, customerCode)
    %% RouteStop: unique(customerId), unique(routeId, sequence)
    %% RouteStop: route.projectId must equal customer.projectId (service check)

    Tenant ||--o{ User : has
    Tenant ||--o{ Project : owns
    Tenant ||--o{ Customer : owns
    Tenant ||--o{ Route : owns
    Project ||--o{ Customer : contains
    Project ||--o{ Route : contains
    User ||--o{ Route : creates
    Route ||--o{ RouteStop : contains
    Customer ||--o| RouteStop : placed_as
```

## Decisions


- **Project:** groups customers and routes. Every customer and route belongs to exactly one project. Map, filters, search, import and route list are all scoped to a project.
- **Customer code:** `customerCode` is unique per project (`unique(projectId, customerCode)`), not per tenant. The same customer can exist in two projects as two rows, each on its own route.
- **One route per customer:** `RouteStop.customerId` stays unique. Because customer rows are project-scoped, this already means one route per customer per project.
- **Cross-project stops:** the DB can't cheaply enforce that a stop's route and customer share a project. The service that adds stops checks it.
- **Tenant on Customer and Route:** redundant with `Project.tenantId`, kept because every query and index is scoped on it.
