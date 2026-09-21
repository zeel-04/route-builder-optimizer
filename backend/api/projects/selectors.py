from django.db.models import Count

from api.projects.models import Project


def project_list(*, tenant, search: str = ""):
    qs = (
        Project.objects.filter(tenant=tenant)
        .annotate(
            customer_count=Count("customers", distinct=True),
            route_count=Count("routes", distinct=True),
        )
        # Most recently updated first; id breaks ties so pages stay stable.
        .order_by("-updated_at", "id")
    )
    if search:
        qs = qs.filter(name__icontains=search)
    return qs


def project_detail(*, tenant, project_id):
    return project_list(tenant=tenant).filter(id=project_id).first()
