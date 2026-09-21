from django.db import transaction
from loguru import logger

from api.accounts.models import Tenant
from api.projects.models import Project


class ProjectCreateService:
    @transaction.atomic
    def execute(self, *, tenant: Tenant, name: str) -> Project:
        project = Project(tenant=tenant, name=name)
        project.full_clean()  # also checks unique (tenant, name) -> 400
        project.save()
        logger.info("project created", project_id=str(project.id), tenant_id=str(tenant.id))
        return project


class ProjectUpdateService:
    @transaction.atomic
    def execute(self, *, project: Project, name: str) -> Project:
        project.name = name
        project.full_clean()  # also checks unique (tenant, name) -> 400
        project.save()
        logger.info("project updated", project_id=str(project.id))
        return project


class ProjectDeleteService:
    @transaction.atomic
    def execute(self, *, project: Project) -> None:
        project_id = str(project.id)
        project.delete()  # cascades to its customers and routes
        logger.info("project deleted", project_id=project_id)
