import io

from api.accounts.models import Tenant
from api.customers.geocoders import Geocoder
from api.customers.models import Customer
from api.customers.schema import GeocodeResult
from api.customers.services.customer_services import (
    CustomerDeleteService,
    CustomerGeocodeService,
    CustomerImportService,
)
from api.projects.models import Project
from api.routes.models import Route, RouteStop


class FakeGeocoder(Geocoder):
    """Finds streets containing 'Ok', fails everything else."""

    def __init__(self):
        self.seen = []

    def geocode(self, query):
        self.seen.append(query.street)
        if "Ok" not in query.street:
            return None
        return GeocodeResult(latitude=1.0, longitude=2.0, accuracy="street", city="X", county="Y")


def test_import_resets_geocode_when_address_changes(db):
    tenant = Tenant.objects.create(name="Import T")
    project = Project.objects.create(tenant=tenant, name="Import P")
    geocoded = dict(latitude=1, longitude=2, location_accuracy="street", city="Albany", county="Albany")
    Customer.objects.create(
        tenant=tenant, project=project, customer_code="1", name="A", address="1 Old St",
        state="NY", zipcode="12201", **geocoded
    )
    Customer.objects.create(
        tenant=tenant, project=project, customer_code="2", name="B", address="2 Same St",
        state="NY", zipcode="12202", **geocoded
    )
    csv_file = io.StringIO(
        "zipcode,state,name,address,customer_code\n"  # any column order, no address2
        "12201,ny,A,1 New St,1\n"
        "12202,NY,B,2 Same St,2\n"
        "501,NY,C,3 Short Zip,3\n"
    )

    result = CustomerImportService().execute(project=project, file=csv_file)

    assert (result.created, result.updated, result.total) == (1, 2, 3)
    moved, same, blank = Customer.objects.filter(project=project).order_by("customer_code")
    assert moved.latitude is None and moved.city == ""
    assert same.latitude is not None and same.city == "Albany"
    assert blank.zipcode == "00501" and blank.tenant == tenant and moved.state == "NY"


def test_geocode_retries_failures_last(db):
    tenant = Tenant.objects.create(name="Geocode T")
    project = Project.objects.create(tenant=tenant, name="Geocode P")
    for code, street in [("1", "1 Bad St"), ("2", "2 Ok St"), ("3", "3 Ok St")]:
        Customer.objects.create(
            tenant=tenant, project=project, customer_code=code, name=code, address=street,
            state="NY", zipcode="12201",
        )
    geocoder = FakeGeocoder()
    service = CustomerGeocodeService(geocoder=geocoder)

    assert service.execute(tenant=tenant, limit=1).failed == 1
    assert service.execute(tenant=tenant, limit=1).street == 1  # skips past the failure
    assert geocoder.seen == ["1 Bad St", "2 Ok St"]

    service.execute(tenant=tenant, limit=0)
    assert len(geocoder.seen) == 2  # --limit 0 geocodes nothing


def test_delete_closes_route_sequence_gap(db):
    tenant = Tenant.objects.create(name="Delete T")
    project = Project.objects.create(tenant=tenant, name="Delete P")
    route = Route.objects.create(tenant=tenant, project=project, name="R", color="#000000")
    customers = [
        Customer.objects.create(
            tenant=tenant, project=project, customer_code=str(n), name=str(n),
            address=f"{n} St", state="NY", zipcode="12201",
        )
        for n in range(1, 5)
    ]
    for sequence, customer in enumerate(customers, start=1):
        RouteStop.objects.create(route=route, customer=customer, sequence=sequence)

    CustomerDeleteService().execute(customer=customers[1])

    assert list(route.stops.values_list("customer__customer_code", "sequence")) == [
        ("1", 1), ("3", 2), ("4", 3)
    ]
