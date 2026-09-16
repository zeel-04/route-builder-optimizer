from django.db.models import Q, QuerySet

from api.customers.models import Customer


def customer_list(*, project, state: str = "", county: str = "", city: str = "", search: str = ""):
    qs: QuerySet[Customer] = Customer.objects.filter(project=project).select_related(
        "route_stop__route"
    )
    if state:
        qs = qs.filter(state__iexact=state)
    if county:
        qs = qs.filter(county__iexact=county)
    if city:
        qs = qs.filter(city__iexact=city)
    if search:
        qs = qs.filter(Q(address__icontains=search) | Q(zipcode__startswith=search))
    return qs.order_by("name")


def customer_filter_options(*, project, state: str = "", county: str = "") -> dict:
    qs = Customer.objects.filter(project=project)
    states = qs.exclude(state="").order_by("state").values_list("state", flat=True).distinct()

    counties_qs = qs
    if state:
        counties_qs = counties_qs.filter(state__iexact=state)
    counties = (
        counties_qs.exclude(county="").order_by("county").values_list("county", flat=True).distinct()
    )

    cities_qs = qs
    if state:
        cities_qs = cities_qs.filter(state__iexact=state)
    if county:
        cities_qs = cities_qs.filter(county__iexact=county)
    cities = cities_qs.exclude(city="").order_by("city").values_list("city", flat=True).distinct()

    return {
        "states": list(states),
        "counties": list(counties),
        "cities": list(cities),
    }
