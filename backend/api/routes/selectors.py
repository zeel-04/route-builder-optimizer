from django.db.models import Count

from api.routes.models import Route


def route_list(*, project):
    return (
        Route.objects.filter(project=project)
        .select_related("created_by")
        .annotate(stop_count=Count("stops"))
        .order_by("-updated_at")
    )


def route_detail(*, tenant, route_id):
    return (
        Route.objects.filter(tenant=tenant, id=route_id)
        .select_related("created_by")
        .annotate(stop_count=Count("stops"))
        .prefetch_related("stops__customer__route_stop__route")
        .first()
    )
