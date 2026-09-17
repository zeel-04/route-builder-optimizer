import csv
import io

from django.http import HttpResponse
from django.shortcuts import get_object_or_404
from django.utils.text import slugify
from rest_framework import status
from rest_framework.decorators import action
from rest_framework.pagination import PageNumberPagination
from rest_framework.parsers import MultiPartParser
from rest_framework.response import Response
from rest_framework.viewsets import ViewSet

from api.customers.models import Customer
from api.customers.selectors import (
    customer_filter_options,
    customer_list,
    project_customer_list,
)
from api.customers.serializers.customer_serializers import (
    CustomerCreateInputSerializer,
    CustomerFilterOptionsFilterSerializer,
    CustomerFilterOptionsOutputSerializer,
    CustomerImportInputSerializer,
    CustomerImportOutputSerializer,
    CustomerListFilterSerializer,
    CustomerListOutputSerializer,
    CustomerUpdateInputSerializer,
    ProjectCustomerListFilterSerializer,
)
from api.customers.services.customer_services import (
    CustomerCreateService,
    CustomerDeleteService,
    CustomerImportService,
    CustomerUpdateService,
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


EXPORT_COLUMNS = [
    # First six match the upload format, so an export can be re-uploaded.
    "customer_code", "name", "address", "address2", "state", "zipcode",
    "city", "county", "latitude", "longitude",
]


class ProjectCustomerPagination(PageNumberPagination):
    page_size = 50
    page_size_query_param = "page_size"
    max_page_size = 200


class ProjectCustomerViewSet(ViewSet):
    """Writes to a project's customers, nested at /projects/{project_pk}/customers/.
    project_pk is UUID-constrained in urls.py, so a malformed id is a 404 too."""

    lookup_value_regex = "[0-9a-fA-F-]{36}"  # same for the customer id

    def list(self, request, project_pk=None):
        project = get_object_or_404(Project, tenant=request.user.tenant, pk=project_pk)
        filters = ProjectCustomerListFilterSerializer(data=request.query_params)
        filters.is_valid(raise_exception=True)

        customers = project_customer_list(project=project, **filters.validated_data)
        paginator = ProjectCustomerPagination()
        page = paginator.paginate_queryset(customers, request, view=self)
        return paginator.get_paginated_response(CustomerListOutputSerializer(page, many=True).data)

    @action(detail=False)
    def export(self, request, project_pk=None):
        project = get_object_or_404(Project, tenant=request.user.tenant, pk=project_pk)
        filename = f"{slugify(project.name) or 'project'}-customers.csv"
        response = HttpResponse(content_type="text/csv; charset=utf-8")
        response["Content-Disposition"] = f'attachment; filename="{filename}"'
        writer = csv.writer(response)
        writer.writerow(EXPORT_COLUMNS)
        for row in project_customer_list(project=project).values_list(*EXPORT_COLUMNS).iterator():
            writer.writerow(["" if value is None else value for value in row])
        return response

    def create(self, request, project_pk=None):
        project = get_object_or_404(Project, tenant=request.user.tenant, pk=project_pk)
        serializer = CustomerCreateInputSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        customer = CustomerCreateService().execute(project=project, **serializer.validated_data)
        return Response(
            CustomerListOutputSerializer(customer).data, status=status.HTTP_201_CREATED
        )

    def partial_update(self, request, project_pk=None, pk=None):
        customer = get_object_or_404(
            Customer, tenant=request.user.tenant, project_id=project_pk, pk=pk
        )
        serializer = CustomerUpdateInputSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        customer = CustomerUpdateService().execute(customer=customer, **serializer.validated_data)
        return Response(CustomerListOutputSerializer(customer).data)

    def destroy(self, request, project_pk=None, pk=None):
        customer = get_object_or_404(
            Customer, tenant=request.user.tenant, project_id=project_pk, pk=pk
        )
        CustomerDeleteService().execute(customer=customer)
        return Response(status=status.HTTP_204_NO_CONTENT)

    @action(detail=False, methods=["post"], parser_classes=[MultiPartParser])
    def upload(self, request, project_pk=None):
        project = get_object_or_404(Project, tenant=request.user.tenant, pk=project_pk)
        serializer = CustomerImportInputSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        file = io.TextIOWrapper(serializer.validated_data["file"], encoding="utf-8-sig", newline="")
        result = CustomerImportService().execute(project=project, file=file)
        return Response(CustomerImportOutputSerializer(result).data)
