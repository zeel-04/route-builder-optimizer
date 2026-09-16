from django.core.exceptions import ValidationError as DjangoValidationError
from django.http import Http404
from django.shortcuts import get_object_or_404
from rest_framework.response import Response
from rest_framework.viewsets import ViewSet

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
