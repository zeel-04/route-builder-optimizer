from django.contrib import admin
from django.urls import include, path

urlpatterns = [
    path("admin/", admin.site.urls),
    path("api/", include("api.accounts.urls")),
    path("api/", include("api.projects.urls")),
    path("api/", include("api.customers.urls")),
    path("api/", include("api.routes.urls")),
]
