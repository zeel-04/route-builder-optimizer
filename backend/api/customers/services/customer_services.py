from dataclasses import dataclass

import openpyxl
from django.conf import settings
from django.db import transaction
from django.db.models import F
from django.utils import timezone
from django.utils.module_loading import import_string
from loguru import logger

from api.accounts.models import Tenant
from api.customers.geocoders import Geocoder
from api.customers.models import Customer
from api.customers.schema import AddressQuery
from api.projects.models import Project


@dataclass(slots=True)
class ImportResult:
    created: int
    updated: int
    total: int


class CustomerImportService:
    """Upserts a project's customers from Pricecenter's Excel export.

    The sheet has no city/county columns — those are filled in later by
    CustomerGeocodeService, from the geocoder's address lookup.
    """

    @transaction.atomic
    def execute(self, *, project: Project, xlsx_path: str) -> ImportResult:
        workbook = openpyxl.load_workbook(xlsx_path, read_only=True)
        sheet = workbook.worksheets[0]

        created = updated = 0
        for row in sheet.iter_rows(min_row=2, values_only=True):
            customer_id, name, address, address2, state, zipcode = row[:6]
            if not customer_id:
                continue
            defaults = {
                "tenant": project.tenant,
                "name": str(name or ""),
                "address": str(address or ""),
                "address2": str(address2) if address2 else "",
                "state": str(state or "").upper(),
                "zipcode": str(zipcode).zfill(5) if zipcode else "",
            }
            # A customer whose address changed keeps a stale pin otherwise —
            # the geocoder only looks at rows with no latitude.
            Customer.objects.filter(project=project, customer_code=str(customer_id)).exclude(
                address=defaults["address"], state=defaults["state"], zipcode=defaults["zipcode"]
            ).update(latitude=None, longitude=None, location_accuracy="", city="", county="")
            _, was_created = Customer.objects.update_or_create(
                project=project, customer_code=str(customer_id), defaults=defaults
            )
            created += was_created
            updated += not was_created

        logger.info(
            "customers imported", project_id=str(project.id), created=created, updated=updated
        )
        return ImportResult(created=created, updated=updated, total=created + updated)


@dataclass(slots=True)
class GeocodeRunResult:
    street: int
    zip: int
    failed: int


class CustomerGeocodeService:
    """Geocodes a tenant's customers that have no coordinates yet.

    Saves each customer as it's geocoded, so a run that's interrupted
    (rate limit, network blip, Ctrl-C) can simply be started again — it
    only ever looks at customers still missing a latitude. Never-tried
    customers go first and past failures last, so a `--limit N` run always
    reaches new rows instead of retrying the same N failures forever.
    """

    def __init__(self, geocoder: Geocoder | None = None):
        self._geocoder = geocoder or import_string(settings.GEOCODER_CLASS)()

    def execute(self, *, tenant: Tenant, limit: int | None = None) -> GeocodeRunResult:
        queryset = Customer.objects.filter(tenant=tenant, latitude__isnull=True).order_by(
            F("geocode_attempted_at").asc(nulls_first=True), "customer_code"
        )
        if limit is not None:
            queryset = queryset[:limit]

        street = zip_ = failed = 0
        for customer in queryset:
            customer.geocode_attempted_at = timezone.now()
            result = self._geocoder.geocode(
                AddressQuery(street=customer.address, zipcode=customer.zipcode, state=customer.state)
            )
            if result is None:
                failed += 1
                customer.save(update_fields=["geocode_attempted_at"])
                logger.warning(
                    "geocode failed",
                    customer_code=customer.customer_code,
                    tenant_id=str(tenant.id),
                )
                continue

            customer.latitude = result.latitude
            customer.longitude = result.longitude
            customer.location_accuracy = result.accuracy
            customer.city = result.city
            customer.county = result.county
            customer.save(
                update_fields=[
                    "latitude",
                    "longitude",
                    "location_accuracy",
                    "city",
                    "county",
                    "geocode_attempted_at",
                ]
            )

            street += result.accuracy == "street"
            zip_ += result.accuracy == "zip"
            logger.info(
                "customer geocoded",
                customer_code=customer.customer_code,
                accuracy=result.accuracy,
            )

        return GeocodeRunResult(street=street, zip=zip_, failed=failed)
