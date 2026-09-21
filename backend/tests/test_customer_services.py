import io

from django.core.management import call_command
from django_tasks import default_task_backend

from api.accounts.models import Tenant
from api.customers.geocoders import Geocoder
from api.customers.models import Customer
from api.customers.schema import GeocodeResult
from api.customers.serializers.customer_serializers import CustomerListOutputSerializer
from api.customers import tasks
from api.customers.services.customer_services import (
    CustomerDeleteService,
    CustomerGeocodeService,
    CustomerImportService,
    CustomerUpdateService,
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


def _queued_tenant_ids():
    return [result.kwargs["tenant_id"] for result in default_task_backend.results]


def test_import_queues_a_geocode_task(db):
    """Uploaded rows have no coordinates, so the import has to queue the
    geocoder itself — otherwise the map shows no pins."""
    tenant = Tenant.objects.create(name="Sched T")
    project = Project.objects.create(tenant=tenant, name="Sched P")
    csv_file = io.StringIO("customer_code,name,address,state,zipcode\n1,A,1 Ok St,NY,12201\n")

    CustomerImportService().execute(project=project, file=csv_file)

    assert _queued_tenant_ids() == [str(tenant.id)]


def test_rejected_import_queues_nothing(db):
    tenant = Tenant.objects.create(name="Reject T")
    project = Project.objects.create(tenant=tenant, name="Reject P")
    csv_file = io.StringIO("customer_code,name,address,state,zipcode\n1,A,1 Ok St,NEWYORK,12201\n")

    try:
        CustomerImportService().execute(project=project, file=csv_file)
    except Exception:
        pass

    assert _queued_tenant_ids() == []


def test_update_queues_a_geocode_only_when_the_pin_is_cleared(db):
    tenant = Tenant.objects.create(name="Upd T")
    project = Project.objects.create(tenant=tenant, name="Upd P")
    customer = Customer.objects.create(
        tenant=tenant, project=project, customer_code="1", name="A", address="1 Ok St",
        state="NY", zipcode="12201", latitude=1, longitude=2, location_accuracy="street",
    )

    CustomerUpdateService().execute(customer=customer, name="Renamed")
    assert _queued_tenant_ids() == []  # still pinned, nothing to look up

    CustomerUpdateService().execute(customer=customer, address="2 Ok St")
    assert _queued_tenant_ids() == [str(tenant.id)]


def test_geocode_task_works_in_batches_until_nothing_is_untried(db, settings, monkeypatch):
    """One batch per task, and the chain stops on its own: an address that
    isn't found stays unpinned forever and must not keep it going."""
    settings.GEOCODER_CLASS = "tests.test_customer_services.FakeGeocoder"
    monkeypatch.setattr(tasks, "GEOCODE_BATCH_SIZE", 2)
    tenant = Tenant.objects.create(name="Batch T")
    project = Project.objects.create(tenant=tenant, name="Batch P")
    for code, address in [("1", "1 Ok St"), ("2", "2 Bad St"), ("3", "3 Ok St")]:
        Customer.objects.create(
            tenant=tenant, project=project, customer_code=code, name=code,
            address=address, state="NY", zipcode="12201",
        )

    first = tasks.geocode_tenant.call(tenant_id=str(tenant.id))
    assert first == {"street": 1, "zip": 0, "failed": 1}
    assert _queued_tenant_ids() == [str(tenant.id)]  # customer 3 is still untried

    default_task_backend.clear()
    second = tasks.geocode_tenant.call(tenant_id=str(tenant.id))
    # Customer 3, plus one more try at the address that wasn't found.
    assert second == {"street": 1, "zip": 0, "failed": 1}
    assert _queued_tenant_ids() == []  # only the not-found address is left: stop
    assert Customer.objects.filter(tenant=tenant, latitude__isnull=False).count() == 2


def test_geocode_task_for_a_deleted_tenant_is_a_no_op(db):
    assert tasks.geocode_tenant.call(tenant_id="00000000-0000-0000-0000-000000000000") is None
    assert _queued_tenant_ids() == []


def test_worker_startup_requeues_only_tenants_with_untried_customers(db):
    """A task killed part-way is never retried, so the worker queues one on
    start for whatever was left behind."""
    stranded = Tenant.objects.create(name="Stranded T")
    done = Tenant.objects.create(name="Done T")
    for tenant, extra in [
        (stranded, {}),
        (stranded, {}),  # two customers, still one task
        (done, {"latitude": 1, "longitude": 2}),
    ]:
        project, _ = Project.objects.get_or_create(tenant=tenant, name="P")
        Customer.objects.create(
            tenant=tenant, project=project, customer_code=str(Customer.objects.count()),
            name="C", address="1 Ok St", state="NY", zipcode="12201", **extra,
        )

    call_command("enqueue_pending_geocodes")

    queued = _queued_tenant_ids()  # the seeded tenants have untried customers too
    assert queued.count(str(stranded.id)) == 1
    assert str(done.id) not in queued


def test_geocode_survives_a_customer_deleted_mid_run(db):
    """The sweep runs for minutes, so a row can vanish under it. Losing one
    must not abandon the customers still queued behind it."""
    tenant = Tenant.objects.create(name="Race T")
    project = Project.objects.create(tenant=tenant, name="Race P")
    for code, address in [("1", "1 Ok St"), ("2", "2 Ok St")]:
        Customer.objects.create(
            tenant=tenant, project=project, customer_code=code, name=code,
            address=address, state="NY", zipcode="12201",
        )

    class DeletingGeocoder(FakeGeocoder):
        """Deletes customer 2 while customer 1 is being looked up."""

        def geocode(self, query):
            if query.street == "1 Ok St":
                Customer.objects.filter(project=project, customer_code="2").delete()
            return super().geocode(query)

    result = CustomerGeocodeService(geocoder=DeletingGeocoder()).execute(tenant=tenant)

    assert result.street == 2  # the deleted row still "succeeds", it just saves nothing
    assert Customer.objects.get(project=project, customer_code="1").latitude is not None


def test_pending_flag_separates_untried_from_not_found(db):
    """The map's loader follows this flag: a lookup that ran and found nothing
    must not keep it spinning, and a new address must start it again."""
    tenant = Tenant.objects.create(name="Pending T")
    project = Project.objects.create(tenant=tenant, name="Pending P")
    customer = Customer.objects.create(
        tenant=tenant, project=project, customer_code="1", name="A",
        address="1 Bad St", state="NY", zipcode="12201",
    )
    is_pending = lambda: CustomerListOutputSerializer(  # noqa: E731
        Customer.objects.get(pk=customer.pk)
    ).data["is_geocode_pending"]

    assert is_pending()  # never tried
    CustomerGeocodeService(geocoder=FakeGeocoder()).execute(tenant=tenant)
    assert not is_pending()  # tried, not found
    CustomerUpdateService().execute(customer=Customer.objects.get(pk=customer.pk), address="2 Bad St")
    assert is_pending()  # new address, not tried yet
