from django.db.models import Count

from api.projects.models import Project


def project_list(*, tenant):
    return (
        Project.objects.filter(tenant=tenant)
        .annotate(
            customer_count=Count("customers", distinct=True),
            route_count=Count("routes", distinct=True),
        )
        .order_by("name")
    )


def project_detail(*, tenant, project_id):
    return project_list(tenant=tenant).filter(id=project_id).first()
