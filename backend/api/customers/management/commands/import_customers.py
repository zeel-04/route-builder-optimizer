from django.core.management.base import BaseCommand

from api.accounts.models import Tenant
from api.customers.services.customer_services import CustomerImportService
from api.projects.models import Project


class Command(BaseCommand):
    help = "Import customers from a CSV file (UTF-8) into a tenant's project."

    def add_arguments(self, parser):
        parser.add_argument("csv_path")
        parser.add_argument("--tenant", required=True)
        parser.add_argument("--project", required=True)

    def handle(self, *args, **options):
        tenant, _ = Tenant.objects.get_or_create(name=options["tenant"])
        project, _ = Project.objects.get_or_create(tenant=tenant, name=options["project"])
        with open(options["csv_path"], encoding="utf-8-sig", newline="") as file:
            result = CustomerImportService().execute(project=project, file=file)
        self.stdout.write(
            self.style.SUCCESS(
                f"Imported {result.total} customers "
                f"({result.created} created, {result.updated} updated) "
                f"into {tenant.name!r} / {project.name!r}."
            )
        )
