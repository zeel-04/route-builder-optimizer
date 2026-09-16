import openpyxl

from api.accounts.models import Tenant
from api.customers.geocoders import Geocoder
from api.customers.models import Customer
from api.customers.schema import GeocodeResult
from api.customers.services.customer_services import (
    CustomerGeocodeService,
    CustomerImportService,
)
from api.projects.models import Project


class FakeGeocoder(Geocoder):
    """Finds streets containing 'Ok', fails everything else."""

    def __init__(self):
        self.seen = []

    def geocode(self, query):
        self.seen.append(query.street)
        if "Ok" not in query.street:
            return None
        return GeocodeResult(latitude=1.0, longitude=2.0, accuracy="street", city="X", county="Y")


def _write_sheet(path, rows):
    workbook = openpyxl.Workbook()
    sheet = workbook.active
    sheet.append(["Customer", "Name", "Address", "Address2", "State", "Zip"])
    for row in rows:
        sheet.append(row)
    workbook.save(path)


def test_import_resets_geocode_when_address_changes(db, tmp_path):
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
    path = tmp_path / "customers.xlsx"
    _write_sheet(
        path,
        [
            ["1", "A", "1 New St", None, "NY", 12201],
            ["2", "B", "2 Same St", None, "NY", 12202],
            ["3", "C", "3 Blank Zip", None, "NY", None],
        ],
    )

    CustomerImportService().execute(project=project, xlsx_path=str(path))

    moved, same, blank = Customer.objects.filter(project=project).order_by("customer_code")
    assert moved.latitude is None and moved.city == ""
    assert same.latitude is not None and same.city == "Albany"
    assert blank.zipcode == "" and blank.tenant == tenant


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
