import csv
import threading
from collections.abc import Iterable
from dataclasses import dataclass
from typing import IO

from django.conf import settings
from django.core.exceptions import ValidationError as DjangoValidationError
from django.db import connection, transaction
from django.db.models import F
from django.utils import timezone
from django.utils.module_loading import import_string
from loguru import logger

from api.accounts.models import Tenant
from api.core.exceptions import ApplicationError
from api.customers.geocoders import Geocoder
from api.customers.models import Customer
from api.customers.schema import AddressQuery
from api.projects.models import Project
from api.routes.models import Route, RouteStop

CUSTOMER_FIELDS = ["customer_code", "name", "address", "address2", "state", "zipcode"]
REQUIRED_COLUMNS = ["customer_code", "name", "address", "state", "zipcode"]


def _normalize(values: dict) -> dict:
    values = {field: str(values.get(field) or "").strip() for field in CUSTOMER_FIELDS}
    values["state"] = values["state"].upper()
    if values["zipcode"]:
        values["zipcode"] = values["zipcode"].zfill(5)
    return values


def _row_errors(project: Project, values: dict) -> list[str]:
    errors = []
    try:
        # Model field rules (required, max_length) stay the source of truth.
        Customer(project=project, **values).clean_fields(exclude=["tenant", "project"])
    except DjangoValidationError as exc:
        errors += [f"{field}: {msg}" for field, msgs in exc.message_dict.items() for msg in msgs]
    if values["state"] and len(values["state"]) != 2:
        errors.append("state: Must be 2 characters.")
    return errors


@dataclass(slots=True)
class ImportResult:
    created: int
    updated: int
    total: int


_geocode_lock = threading.Lock()


def _schedule_geocode(tenant: Tenant) -> None:
    """Nothing else fills in coordinates, so customers created through the API
    have no map pin until this runs. Nominatim's 1 req/sec cap makes it far too
    slow for the request itself, so it runs after the rows are committed.

    ponytail: in-process thread, so a restart drops the run in flight and
    every web instance geocodes its own uploads. Both are self-correcting —
    the service only ever looks at rows still missing a latitude — and the
    lock keeps this process to one Nominatim call at a time. Move it to a
    task queue when a dropped run costs more than the next upload.
    """

    def run() -> None:
        with _geocode_lock:
            try:
                CustomerGeocodeService().execute(tenant=tenant)
            except Exception:
                logger.exception("background geocode failed", tenant_id=str(tenant.id))
            finally:
                # No request ends this thread, so nothing else would hand the
                # pooler its connection back (CONN_MAX_AGE is 0).
                connection.close()

    threading.Thread(target=run, name="geocode", daemon=False).start()


class CustomerCreateService:
    @transaction.atomic
    def execute(self, *, project: Project, **values) -> Customer:
        customer = Customer(tenant=project.tenant, project=project, **_normalize(values))
        customer.full_clean()  # also checks unique (project, customer_code) -> 400
        customer.save()
        logger.info(
            "customer created", project_id=str(project.id), customer_code=customer.customer_code
        )
        transaction.on_commit(lambda: _schedule_geocode(project.tenant))
        return customer


GEOCODE_FIELDS = ["address", "state", "zipcode"]


class CustomerUpdateService:
    @transaction.atomic
    def execute(self, *, customer: Customer, **values) -> Customer:
        values = {field: value for field, value in _normalize(values).items() if field in values}
        # Same rule as the import: a moved customer drops its pin so the
        # geocoder (which only picks rows with no latitude) runs again.
        if any(getattr(customer, field) != values[field] for field in GEOCODE_FIELDS if field in values):
            values.update(
                latitude=None, longitude=None, location_accuracy="", city="", county="",
                geocode_attempted_at=None,  # the new address hasn't been tried
            )
        for field, value in values.items():
            setattr(customer, field, value)
        customer.full_clean()  # also checks unique (project, customer_code) -> 400
        customer.save()
        logger.info(
            "customer updated", customer_id=str(customer.id), fields=sorted(values)
        )
        if customer.latitude is None:
            transaction.on_commit(lambda: _schedule_geocode(customer.tenant))
        return customer


class CustomerDeleteService:
    """Deleting cascades to the customer's RouteStop; the stops after it on
    that route are shifted down so the sequence stays 1..n with no gap."""

    @transaction.atomic
    def execute(self, *, customer: Customer) -> None:
        customer_id = str(customer.id)
        stop = RouteStop.objects.filter(customer=customer).first()
        if stop is not None:
            # Lock the route before the customer row (same order as
            # RouteUpdateService) so a concurrent stop rewrite can't deadlock.
            Route.objects.select_for_update().get(pk=stop.route_id)
        customer.delete()
        if stop is not None:
            # One row at a time, ascending: each target sequence was just
            # freed, so unique (route, sequence) never trips mid-update.
            later = RouteStop.objects.filter(route_id=stop.route_id, sequence__gt=stop.sequence)
            for later_stop in later.order_by("sequence"):
                later_stop.sequence -= 1
                later_stop.save(update_fields=["sequence"])
        logger.info("customer deleted", customer_id=customer_id)


class CustomerImportService:
    """Upserts a project's customers from a CSV (header row, columns matched
    by name). Never deletes. All-or-nothing: any invalid row rejects the file.

    City/county aren't in the file — CustomerGeocodeService fills them later.
    """

    @transaction.atomic
    def execute(self, *, project: Project, file: IO[str] | Iterable[str]) -> ImportResult:
        try:
            reader = csv.DictReader(file)
            header = [name.strip() for name in reader.fieldnames or []]
            missing = [column for column in REQUIRED_COLUMNS if column not in header]
            if missing:
                raise ApplicationError(
                    f"Missing required columns: {', '.join(missing)}.",
                    extra={"missing_columns": missing},
                )
            reader.fieldnames = header
            rows = [
                (number, _normalize(row))
                for number, row in enumerate(reader, start=2)  # row 1 is the header
                if any((value or "").strip() for value in row.values() if isinstance(value, str))
            ]
        except (UnicodeDecodeError, csv.Error) as exc:
            raise ApplicationError("File is not a valid UTF-8 CSV.") from exc

        errors = {number: e for number, values in rows if (e := _row_errors(project, values))}
        if errors:
            raise ApplicationError(
                f"{len(errors)} row(s) have invalid or missing values.",
                extra={
                    "rows": list(errors),
                    "errors": [{"row": n, "messages": m} for n, m in errors.items()],
                },
            )

        created = updated = 0
        for _, values in rows:
            code = values.pop("customer_code")
            # A customer whose address changed keeps a stale pin otherwise —
            # the geocoder only looks at rows with no latitude.
            Customer.objects.filter(project=project, customer_code=code).exclude(
                address=values["address"], state=values["state"], zipcode=values["zipcode"]
            ).update(
                latitude=None, longitude=None, location_accuracy="", city="", county="",
                geocode_attempted_at=None,  # the new address hasn't been tried
            )
            _, was_created = Customer.objects.update_or_create(
                project=project,
                customer_code=code,
                defaults={"tenant": project.tenant, **values},
            )
            created += was_created
            updated += not was_created

        logger.info(
            "customers imported", project_id=str(project.id), created=created, updated=updated
        )
        transaction.on_commit(lambda: _schedule_geocode(project.tenant))
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
            result = self._geocoder.geocode(
                AddressQuery(street=customer.address, zipcode=customer.zipcode, state=customer.state)
            )
            fields = {"geocode_attempted_at": timezone.now()}
            if result is None:
                failed += 1
                logger.warning(
                    "geocode failed",
                    customer_code=customer.customer_code,
                    tenant_id=str(tenant.id),
                )
            else:
                fields.update(
                    latitude=result.latitude,
                    longitude=result.longitude,
                    location_accuracy=result.accuracy,
                    city=result.city,
                    county=result.county,
                )
                street += result.accuracy == "street"
                zip_ += result.accuracy == "zip"
                logger.info(
                    "customer geocoded",
                    customer_code=customer.customer_code,
                    accuracy=result.accuracy,
                )

            # A sweep takes minutes, so a customer can be deleted while it
            # runs. An UPDATE just matches no rows; customer.save(update_fields)
            # raises there and abandons every row still left in the run.
            # updated_at is auto_now, which .update() doesn't apply itself.
            Customer.objects.filter(pk=customer.pk).update(
                updated_at=timezone.now(), **fields
            )

        return GeocodeRunResult(street=street, zip=zip_, failed=failed)
