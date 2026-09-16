import json
import re
import uuid
from pathlib import Path
from urllib.parse import urlencode

import pytest
from django.core.management import call_command
from rest_framework.authtoken.models import Token
from rest_framework.test import APIClient

from api.accounts.models import Tenant, User
from api.customers.geocoders import NominatimGeocoder
from api.customers.models import Customer
from api.customers.schema import PlaceResult
from api.projects.models import Project
from api.routes.models import Route, RouteStop

TEST_DATA_DIR = Path(__file__).parent / "test_data"
PASSWORD = "TestPass123!"


def _seed():
    """Two tenants with a user, a project, customers, and a route each — the
    fixed dataset every test_data/**/*.json case is written against. Tenant A
    has a second project holding a customer with the same code as one in its
    first project, to prove customer codes are unique per project."""
    tenant_a = Tenant.objects.create(name="Tenant A")
    tenant_b = Tenant.objects.create(name="Tenant B")

    user_a = User.objects.create_user(
        email="user-a@example.com", password=PASSWORD, name="User A", tenant=tenant_a
    )
    # Separate user for the logout case, so deleting its token doesn't
    # invalidate {token_a} for every other case that runs after it.
    user_a2 = User.objects.create_user(
        email="user-a2@example.com", password=PASSWORD, name="User A2", tenant=tenant_a
    )
    user_b = User.objects.create_user(
        email="user-b@example.com", password=PASSWORD, name="User B", tenant=tenant_b
    )
    User.objects.create_superuser(email="admin@example.com", password=PASSWORD, name="Admin")

    project_a = Project.objects.create(tenant=tenant_a, name="Project A")
    project_a2 = Project.objects.create(tenant=tenant_a, name="Project A2")
    project_b = Project.objects.create(tenant=tenant_b, name="Project B")

    cust_a_free = Customer.objects.create(
        tenant=tenant_a, project=project_a, customer_code="A-FREE-1", name="A Free One",
        address="1 Elm St", city="Albany", county="Albany", state="NY", zipcode="12201",
    )
    cust_a_free2 = Customer.objects.create(
        tenant=tenant_a, project=project_a, customer_code="A-FREE-2", name="A Free Two",
        address="2 Elm St", city="Albany", county="Albany", state="NY", zipcode="12202",
    )
    cust_a_taken = Customer.objects.create(
        tenant=tenant_a, project=project_a, customer_code="A-TAKEN-1", name="A Taken One",
        address="3 Elm St", city="Albany", county="Albany", state="NY", zipcode="12203",
    )
    # Same customer as cust_a_free, imported into tenant A's second project.
    cust_a2_free = Customer.objects.create(
        tenant=tenant_a, project=project_a2, customer_code="A-FREE-1", name="A Free One",
        address="1 Elm St", city="Albany", county="Albany", state="NY", zipcode="12201",
    )
    cust_b_taken = Customer.objects.create(
        tenant=tenant_b, project=project_b, customer_code="B-TAKEN-1", name="B Taken One",
        address="1 Oak St", city="Fresno", county="Fresno", state="CA", zipcode="93650",
    )
    cust_b_free = Customer.objects.create(
        tenant=tenant_b, project=project_b, customer_code="B-FREE-1", name="B Free One",
        address="2 Oak St", city="Fresno", county="Fresno", state="CA", zipcode="93651",
    )

    route_a = Route.objects.create(
        tenant=tenant_a, project=project_a, name="Route A", color="#ff0000", created_by=user_a
    )
    RouteStop.objects.create(route=route_a, customer=cust_a_taken, sequence=1)

    route_b = Route.objects.create(
        tenant=tenant_b, project=project_b, name="Route B", color="#00ff00", created_by=user_b
    )
    RouteStop.objects.create(route=route_b, customer=cust_b_taken, sequence=1)

    token_a = Token.objects.create(user=user_a)
    token_a2 = Token.objects.create(user=user_a2)
    token_b = Token.objects.create(user=user_b)

    return {
        "token_a": token_a.key,
        "token_a2": token_a2.key,
        "token_b": token_b.key,
        "tenant_a_project_id": str(project_a.id),
        "tenant_a_project2_id": str(project_a2.id),
        "tenant_b_project_id": str(project_b.id),
        "tenant_a_route_id": str(route_a.id),
        "tenant_b_route_id": str(route_b.id),
        "tenant_a_customer_free_id": str(cust_a_free.id),
        "tenant_a_customer_free2_id": str(cust_a_free2.id),
        "tenant_a_customer_taken_id": str(cust_a_taken.id),
        "tenant_a_project2_customer_id": str(cust_a2_free.id),
        "tenant_b_customer_id": str(cust_b_taken.id),
        "tenant_b_customer_free_id": str(cust_b_free.id),
        "cust_a_free_zip": cust_a_free.zipcode,
        "cust_b_taken_zip": cust_b_taken.zipcode,
        "password": PASSWORD,
        "admin_email": "admin@example.com",
        "random_uuid": str(uuid.uuid4()),
    }


@pytest.fixture(scope="session")
def django_db_setup(django_db_setup, django_db_blocker):
    with django_db_blocker.unblock():
        # --reuse-db keeps the schema across runs but not a clean slate —
        # flush leftover rows from the previous run before reseeding.
        call_command("flush", interactive=False)
        seeded = _seed()
    return seeded


@pytest.fixture(scope="session")
def placeholders(django_db_setup):
    return django_db_setup


_PLACEHOLDER_RE = re.compile(r"\{(\w+)\}")


def _substitute(value, placeholders: dict):
    if isinstance(value, str):
        return _PLACEHOLDER_RE.sub(lambda m: str(placeholders.get(m.group(1), m.group(0))), value)
    if isinstance(value, list):
        return [_substitute(v, placeholders) for v in value]
    if isinstance(value, dict):
        return {k: _substitute(v, placeholders) for k, v in value.items()}
    return value


def load_all_cases() -> list[dict]:
    cases = []
    for path in sorted(TEST_DATA_DIR.glob("**/*.json")):
        cases.extend(json.loads(path.read_text()))
    return cases


class ApiClient:
    """Thin wrapper around DRF's APIClient matching the data-driven runner's
    call shape (method, url, json=, headers=, params=) without needing a real
    live_server — in-process is enough for these tests and keeps the whole
    seed dataset alive across the session instead of being flushed per test.
    """

    def __init__(self):
        self.client = APIClient()
        self.base_url = ""

    def request(self, method, url, json_body=None, headers=None, params=None):
        extra = {}
        for key, value in (headers or {}).items():
            if key.lower() == "authorization":
                extra["HTTP_AUTHORIZATION"] = value
            else:
                extra[f"HTTP_{key.upper().replace('-', '_')}"] = value
        body = json.dumps(json_body) if json_body is not None else None
        return self.client.generic(
            method, url, data=body, content_type="application/json",
            QUERY_STRING=urlencode(params or {}), **extra,
        )


def _fake_search_place(self, **parts):
    """Matches any search whose street contains 'Main'; everything else is a miss."""
    if "Main" not in parts.get("street", ""):
        return None
    return PlaceResult(latitude=40.73, longitude=-74.17, label="12 Main St, Newark, NJ")


@pytest.fixture(autouse=True)
def _no_network_geocoder(monkeypatch):
    monkeypatch.setattr(NominatimGeocoder, "search_place", _fake_search_place)


@pytest.fixture
def api():
    return ApiClient()


@pytest.fixture
def substitute():
    return _substitute


def pytest_generate_tests(metafunc):
    if "case" in metafunc.fixturenames:
        cases = load_all_cases()
        metafunc.parametrize("case", cases, ids=[c["id"] for c in cases])
