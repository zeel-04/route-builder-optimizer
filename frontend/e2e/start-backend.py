"""Start the real API with disposable, deterministic fixtures for Playwright."""
import os
import sys
from pathlib import Path
from uuid import UUID

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "backend"))
os.environ["DJANGO_SETTINGS_MODULE"] = "config.settings.e2e"

import django  # noqa: E402

django.setup()

from django.conf import settings  # noqa: E402
from django.core.management import call_command  # noqa: E402
from django.utils import timezone  # noqa: E402
from api.accounts.models import Tenant, User  # noqa: E402
from api.customers.models import Customer  # noqa: E402
from api.projects.models import Project  # noqa: E402
from api.routes.models import Route, RouteStop  # noqa: E402

database = Path(settings.DATABASES["default"]["NAME"])
assert database == ROOT / "frontend" / ".e2e" / "backend.sqlite3"
database.parent.mkdir(exist_ok=True)
database.unlink(missing_ok=True)
call_command("migrate", run_syncdb=True, verbosity=0)

def uid(number):
    return UUID(int=number)

tenant = Tenant.objects.create(name="Playwright fixtures")
user = User.objects.create_user(email="playwright@example.com", password="Playwright123!", tenant=tenant, name="Test Planner")
project = Project.objects.create(id=uid(100), tenant=tenant, name="Delivery Planning")
complete = Project.objects.create(id=uid(101), tenant=tenant, name="Fully Assigned")
empty = Project.objects.create(id=uid(102), tenant=tenant, name="Empty Project")
foreign_tenant = Tenant.objects.create(name="Other tenant")
Project.objects.create(id=uid(103), tenant=foreign_tenant, name="Private Project")
customers = []
for i in range(58):
    customers.append(Customer.objects.create(
        id=uid(1000 + i), tenant=tenant, project=project,
        customer_code=f"C{i:03}", name=f"Customer {i:02}",
        address="Available Plaza" if i == 2 else f"{i} Market St", state="NY" if i < 35 else "NJ",
        city="New York" if i < 35 else "Jersey City", county="New York" if i < 35 else "Hudson",
        zipcode="10001" if i < 35 else "07030",
        latitude=None if i == 56 else 40.70 + (i // 8) * .004,
        longitude=None if i == 56 else -74.04 + (i % 8) * .004,
        location_accuracy="" if i == 56 else "zip" if i == 3 else "street",
        geocode_attempted_at=timezone.now(),
    ))
route = Route.objects.create(id=uid(200), tenant=tenant, project=project, name="Morning Route", color="#0064E0", created_by=user)
other = Route.objects.create(id=uid(201), tenant=tenant, project=project, name="Afternoon Route", color="#0D8626", created_by=user)
RouteStop.objects.create(route=route, customer=customers[0], sequence=1)
RouteStop.objects.create(route=route, customer=customers[57], sequence=2)
RouteStop.objects.create(route=other, customer=customers[1], sequence=1)
complete_route = Route.objects.create(id=uid(202), tenant=tenant, project=complete, name="Complete Route", color="#0064E0", created_by=user)
for i in range(3):
    customer = Customer.objects.create(tenant=tenant, project=complete, customer_code=f"F{i}", name=f"Assigned {i}", address=f"{i} Full St", state="NY", zipcode="10001", latitude=40.7, longitude=-74.0, geocode_attempted_at=timezone.now())
    RouteStop.objects.create(route=complete_route, customer=customer, sequence=i + 1)

call_command("runserver", "127.0.0.1:8001", use_reloader=False)
