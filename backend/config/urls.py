from django.contrib import admin
from django.http import HttpResponse
from django.urls import include, path


def healthz(request):
    return HttpResponse("ok", content_type="text/plain")


urlpatterns = [
    path("healthz/", healthz),
    path("admin/", admin.site.urls),
    path("api/", include("api.accounts.urls")),
    path("api/", include("api.projects.urls")),
    path("api/", include("api.customers.urls")),
    path("api/", include("api.routes.urls")),
]
