from django.db import transaction
from loguru import logger

from api.core.exceptions import ApplicationError
from api.customers.models import Customer
from api.routes.models import Route, RouteStop


def _validate_customer_ids(*, project, customer_ids: list, exclude_route: Route | None = None) -> None:
    str_ids = [str(cid) for cid in customer_ids]
    if len(str_ids) != len(set(str_ids)):
        raise ApplicationError("Duplicate customers in the same route.")

    # Row locks so two concurrent requests can't both pass the "already on
    # another route" check below and race into the unique constraint.
    # Filtering by project is also the cross-project check: another
    # project's customer is simply "not found", like another tenant's.
    found_ids = {
        str(cid)
        for cid in Customer.objects.select_for_update()
        .filter(project=project, id__in=customer_ids)
        .values_list("id", flat=True)
    }
    missing_ids = [cid for cid in str_ids if cid not in found_ids]
    if missing_ids:
        raise ApplicationError(
            "Some customers were not found.", extra={"customer_ids": missing_ids}
        )

    taken_stops = RouteStop.objects.filter(customer_id__in=customer_ids)
    if exclude_route is not None:
        taken_stops = taken_stops.exclude(route=exclude_route)
    taken_ids = [str(cid) for cid in taken_stops.values_list("customer_id", flat=True)]
    if taken_ids:
        raise ApplicationError(
            "Some customers are already on another route.",
            extra={"customer_ids": taken_ids},
        )


def _set_stops(*, route: Route, customer_ids: list) -> None:
    RouteStop.objects.filter(route=route).delete()
    RouteStop.objects.bulk_create(
        RouteStop(route=route, customer_id=customer_id, sequence=index)
        for index, customer_id in enumerate(customer_ids, start=1)
    )


class RouteCreateService:
    @transaction.atomic
    def execute(self, *, project, created_by, name: str, color: str, customer_ids: list) -> Route:
        _validate_customer_ids(project=project, customer_ids=customer_ids)

        route = Route(
            tenant=project.tenant, project=project, name=name, color=color, created_by=created_by
        )
        route.full_clean()
        route.save()
        _set_stops(route=route, customer_ids=customer_ids)

        logger.info("route created", route_id=str(route.id), project_id=str(project.id))
        return route


class RouteUpdateService:
    @transaction.atomic
    def execute(
        self,
        *,
        route: Route,
        name: str | None = None,
        color: str | None = None,
        customer_ids: list | None = None,
    ) -> Route:
        # Lock the route so two concurrent PATCHes can't both rewrite its stops.
        route = Route.objects.select_for_update().get(pk=route.pk)
        if customer_ids is not None:
            _validate_customer_ids(
                project=route.project, customer_ids=customer_ids, exclude_route=route
            )

        if name is not None:
            route.name = name
        if color is not None:
            route.color = color
        route.full_clean()
        route.save()

        if customer_ids is not None:
            _set_stops(route=route, customer_ids=customer_ids)

        logger.info("route updated", route_id=str(route.id))
        return route


class RouteDeleteService:
    @transaction.atomic
    def execute(self, *, route: Route) -> None:
        route_id = str(route.id)
        route.delete()
        logger.info("route deleted", route_id=route_id)
