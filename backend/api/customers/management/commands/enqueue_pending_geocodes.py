from django.core.management.base import BaseCommand

from api.customers.models import Customer
from api.customers.tasks import geocode_tenant


class Command(BaseCommand):
    help = "Queue a geocode task for every tenant with customers that were never looked up."

    def handle(self, *args, **options):
        # The worker runs this on start. A task killed part-way (crash, OOM) is
        # never retried, which would leave its customers pending until the next
        # upload; this picks them back up instead.
        tenant_ids = (
            Customer.objects.filter(latitude__isnull=True, geocode_attempted_at__isnull=True)
            .order_by()
            .values_list("tenant_id", flat=True)
            .distinct()
        )
        for tenant_id in tenant_ids:
            geocode_tenant.enqueue(tenant_id=str(tenant_id))
        self.stdout.write(self.style.SUCCESS(f"Queued geocoding for {len(tenant_ids)} tenant(s)."))
