import csv

from django.core.exceptions import ValidationError as DjangoValidationError
from django.http import Http404, HttpResponse
from django.shortcuts import get_object_or_404
from django.utils.text import slugify
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.viewsets import ViewSet

from api.customers.views.customer_view import EXPORT_COLUMNS
from api.projects.models import Project
from api.routes.selectors import route_detail, route_list
from api.routes.serializers.route_serializers import (
    RouteDetailOutputSerializer,
    RouteListFilterSerializer,
    RouteListOutputSerializer,
    RouteUpdateInputSerializer,
    RouteWriteInputSerializer,
)
from api.routes.services.route_services import (
    RouteCreateService,
    RouteDeleteService,
    RouteUpdateService,
)


def _get_route_or_404(*, tenant, route_id):
    try:
        route = route_detail(tenant=tenant, route_id=route_id)
    except DjangoValidationError:  # not a UUID at all — same 404 as an unknown id
        route = None
    if route is None:
        raise Http404
    return route


class RouteViewSet(ViewSet):
    def list(self, request):
        filters = RouteListFilterSerializer(data=request.query_params)
        filters.is_valid(raise_exception=True)
        project = get_object_or_404(
            Project, tenant=request.user.tenant, pk=filters.validated_data["project"]
        )

        routes = route_list(project=project)
        return Response(RouteListOutputSerializer(routes, many=True).data)

    def create(self, request):
        serializer = RouteWriteInputSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        project = get_object_or_404(
            Project, tenant=request.user.tenant, pk=serializer.validated_data.pop("project")
        )

        route = RouteCreateService().execute(
            project=project, created_by=request.user, **serializer.validated_data
        )
        detail = route_detail(tenant=request.user.tenant, route_id=route.id)
        return Response(RouteDetailOutputSerializer(detail).data, status=201)

    def retrieve(self, request, pk=None):
        route = _get_route_or_404(tenant=request.user.tenant, route_id=pk)
        return Response(RouteDetailOutputSerializer(route).data)

    def partial_update(self, request, pk=None):
        route = _get_route_or_404(tenant=request.user.tenant, route_id=pk)
        serializer = RouteUpdateInputSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        RouteUpdateService().execute(route=route, **serializer.validated_data)
        detail = route_detail(tenant=request.user.tenant, route_id=route.id)
        return Response(RouteDetailOutputSerializer(detail).data)

    def destroy(self, request, pk=None):
        route = _get_route_or_404(tenant=request.user.tenant, route_id=pk)
        RouteDeleteService().execute(route=route)
        return Response(status=204)

    @action(detail=True)
    def export(self, request, pk=None):
        route = _get_route_or_404(tenant=request.user.tenant, route_id=pk)
        filename = f"{slugify(route.name) or 'route'}.csv"
        response = HttpResponse(content_type="text/csv; charset=utf-8")
        response["Content-Disposition"] = f'attachment; filename="{filename}"'
        writer = csv.writer(response)
        writer.writerow(["stop", *EXPORT_COLUMNS])
        fields = [f"customer__{column}" for column in EXPORT_COLUMNS]
        for row in route.stops.order_by("sequence").values_list("sequence", *fields):
            writer.writerow(["" if value is None else value for value in row])
        return response
