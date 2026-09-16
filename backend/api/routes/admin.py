from django.contrib import admin

from api.routes.models import Route, RouteStop


class RouteStopInline(admin.TabularInline):
    model = RouteStop
    extra = 0
    ordering = ("sequence",)


@admin.register(Route)
class RouteAdmin(admin.ModelAdmin):
    list_display = ("name", "project", "tenant", "color", "created_by", "updated_at")
    list_filter = ("tenant", "project")
    search_fields = ("name",)
    inlines = [RouteStopInline]
