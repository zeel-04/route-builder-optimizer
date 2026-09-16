from django.db import models

from api.accounts.models import Tenant
from api.core.models import BaseModel


class Project(BaseModel):
    tenant = models.ForeignKey(Tenant, on_delete=models.CASCADE, related_name="projects")
    name = models.CharField(max_length=255)

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=["tenant", "name"], name="unique_tenant_project_name")
        ]

    def __str__(self):
        return self.name
