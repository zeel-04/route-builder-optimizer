from django.shortcuts import get_object_or_404
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.viewsets import ViewSet

from api.customers.selectors import customer_filter_options, customer_list
from api.customers.serializers.customer_serializers import (
    CustomerFilterOptionsFilterSerializer,
    CustomerFilterOptionsOutputSerializer,
    CustomerListFilterSerializer,
    CustomerListOutputSerializer,
)
from api.projects.models import Project


class CustomerViewSet(ViewSet):
    def list(self, request):
        filters = CustomerListFilterSerializer(data=request.query_params)
        filters.is_valid(raise_exception=True)
        project = get_object_or_404(
            Project, tenant=request.user.tenant, pk=filters.validated_data.pop("project")
        )

        customers = customer_list(project=project, **filters.validated_data)
        return Response(CustomerListOutputSerializer(customers, many=True).data)

    @action(detail=False, url_path="filter-options")
    def filter_options(self, request):
        filters = CustomerFilterOptionsFilterSerializer(data=request.query_params)
        filters.is_valid(raise_exception=True)
        project = get_object_or_404(
            Project, tenant=request.user.tenant, pk=filters.validated_data.pop("project")
        )

        options = customer_filter_options(project=project, **filters.validated_data)
        return Response(CustomerFilterOptionsOutputSerializer(options).data)
