from dataclasses import asdict

from django_tasks import task

from api.accounts.models import Tenant
from api.customers.models import Customer

# Nominatim allows one request a second, so a batch is about a minute of work.
# The worker finishes the task in hand before it stops for a deploy, and a task
# killed part-way is never retried — small batches keep both of those cheap.
GEOCODE_BATCH_SIZE = 25


@task()
def geocode_tenant(tenant_id: str) -> dict | None:
    """Geocodes one batch of a tenant's unpinned customers, then queues itself
    again while any customer still hasn't been looked up."""
    # Imported here: the services module imports this one to enqueue it.
    from api.customers.services.customer_services import CustomerGeocodeService

    tenant = Tenant.objects.filter(pk=tenant_id).first()
    if tenant is None:  # deleted after the task was queued
        return None

    result = CustomerGeocodeService().execute(tenant=tenant, limit=GEOCODE_BATCH_SIZE)

    # Only never-tried customers keep the chain going. Addresses that were tried
    # and not found stay unpinned for good, so counting them would loop forever.
    if Customer.objects.filter(
        tenant=tenant, latitude__isnull=True, geocode_attempted_at__isnull=True
    ).exists():
        geocode_tenant.enqueue(tenant_id=tenant_id)
    return asdict(result)
