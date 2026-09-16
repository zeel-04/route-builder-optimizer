from django.core.exceptions import ValidationError as DjangoValidationError
from django.http import Http404
from rest_framework.response import Response
from rest_framework.viewsets import ViewSet

from api.projects.selectors import project_detail, project_list
from api.projects.serializers.project_serializers import ProjectOutputSerializer


def _get_project_or_404(*, tenant, project_id):
    try:
        project = project_detail(tenant=tenant, project_id=project_id)
    except DjangoValidationError:  # not a UUID at all — same 404 as an unknown id
        project = None
    if project is None:
        raise Http404
    return project


class ProjectViewSet(ViewSet):
    def list(self, request):
        projects = project_list(tenant=request.user.tenant)
        return Response(ProjectOutputSerializer(projects, many=True).data)

    def retrieve(self, request, pk=None):
        project = _get_project_or_404(tenant=request.user.tenant, project_id=pk)
        return Response(ProjectOutputSerializer(project).data)
