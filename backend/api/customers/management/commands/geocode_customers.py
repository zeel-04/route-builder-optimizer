from django.core.management.base import BaseCommand, CommandError

from api.accounts.models import Tenant
from api.customers.services.customer_services import CustomerGeocodeService


class Command(BaseCommand):
    help = "Geocode a tenant's customers that don't have coordinates yet."

    def add_arguments(self, parser):
        parser.add_argument("--tenant", required=True)
        parser.add_argument("--limit", type=int, default=None)

    def handle(self, *args, **options):
        try:
            tenant = Tenant.objects.get(name=options["tenant"])
        except Tenant.DoesNotExist as exc:
            raise CommandError(f"No tenant named {options['tenant']!r}.") from exc

        result = CustomerGeocodeService().execute(tenant=tenant, limit=options["limit"])
        self.stdout.write(
            self.style.SUCCESS(
                f"Geocoded {result.street} street-level, {result.zip} ZIP-level, "
                f"{result.failed} failed."
            )
        )
