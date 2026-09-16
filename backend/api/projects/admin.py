from django.contrib import admin

from api.projects.models import Project


@admin.register(Project)
class ProjectAdmin(admin.ModelAdmin):
    list_display = ("name", "tenant", "updated_at")
    list_filter = ("tenant",)
