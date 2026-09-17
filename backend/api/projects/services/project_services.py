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
