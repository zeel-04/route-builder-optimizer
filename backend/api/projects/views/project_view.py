from django.core.exceptions import ValidationError as DjangoValidationError
from django.http import Http404
from rest_framework import status
from rest_framework.pagination import PageNumberPagination
from rest_framework.response import Response
from rest_framework.viewsets import ViewSet

from api.projects.selectors import project_detail, project_list
from api.projects.serializers.project_serializers import (
    ProjectCreateInputSerializer,
    ProjectListFilterSerializer,
    ProjectOutputSerializer,
)
from api.projects.services.project_services import (
    ProjectCreateService,
    ProjectDeleteService,
    ProjectUpdateService,
)


def _get_project_or_404(*, tenant, project_id):
    try:
        project = project_detail(tenant=tenant, project_id=project_id)
    except DjangoValidationError:  # not a UUID at all — same 404 as an unknown id
        project = None
    if project is None:
        raise Http404
    return project


class ProjectPagination(PageNumberPagination):
    page_size = 25
    page_size_query_param = "page_size"
    max_page_size = 100


class ProjectViewSet(ViewSet):
    def list(self, request):
        filters = ProjectListFilterSerializer(data=request.query_params)
        filters.is_valid(raise_exception=True)

        projects = project_list(tenant=request.user.tenant, **filters.validated_data)
        paginator = ProjectPagination()
        page = paginator.paginate_queryset(projects, request, view=self)
        return paginator.get_paginated_response(ProjectOutputSerializer(page, many=True).data)

    def retrieve(self, request, pk=None):
        project = _get_project_or_404(tenant=request.user.tenant, project_id=pk)
        return Response(ProjectOutputSerializer(project).data)

    def create(self, request):
        serializer = ProjectCreateInputSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        project = ProjectCreateService().execute(
            tenant=request.user.tenant, **serializer.validated_data
        )
        project = project_detail(tenant=request.user.tenant, project_id=project.id)
        return Response(ProjectOutputSerializer(project).data, status=status.HTTP_201_CREATED)

    def partial_update(self, request, pk=None):
        project = _get_project_or_404(tenant=request.user.tenant, project_id=pk)
        # The name is the only editable field, so an update takes the same input as a create.
        serializer = ProjectCreateInputSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        ProjectUpdateService().execute(project=project, **serializer.validated_data)
        project = project_detail(tenant=request.user.tenant, project_id=project.id)
        return Response(ProjectOutputSerializer(project).data)

    def destroy(self, request, pk=None):
        project = _get_project_or_404(tenant=request.user.tenant, project_id=pk)
        ProjectDeleteService().execute(project=project)
        return Response(status=status.HTTP_204_NO_CONTENT)
