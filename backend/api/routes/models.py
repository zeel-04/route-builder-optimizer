import uuid

from django.db import models
from django.db.models import Q
from django.utils import timezone

from api.accounts.models import Tenant, User
from api.core.models import BaseModel
from api.customers.models import Customer
from api.projects.models import Project


class Route(BaseModel):
    tenant = models.ForeignKey(Tenant, on_delete=models.CASCADE, related_name="routes")
    project = models.ForeignKey(Project, on_delete=models.CASCADE, related_name="routes")
    name = models.CharField(max_length=255)
    color = models.CharField(max_length=7)
    created_by = models.ForeignKey(
        User, on_delete=models.SET_NULL, null=True, blank=True, related_name="routes_created"
    )

    class Meta:
        constraints = [
            models.CheckConstraint(
                name="route_color_is_hex", condition=Q(color__regex=r"^#[0-9A-Fa-f]{6}$")
            )
        ]

    def __str__(self):
        return self.name


class RouteStop(models.Model):
    # Data model has no updatedAt for RouteStop, so this doesn't use
    # BaseModel — just the id and created_at it does call for.
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    route = models.ForeignKey(Route, on_delete=models.CASCADE, related_name="stops")
    customer = models.OneToOneField(
        Customer, on_delete=models.CASCADE, related_name="route_stop"
    )
    sequence = models.PositiveIntegerField()
    created_at = models.DateTimeField(db_index=True, default=timezone.now)

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=["route", "sequence"], name="unique_route_sequence")
        ]
        ordering = ["sequence"]

    def __str__(self):
        return f"{self.route.name} #{self.sequence} — {self.customer.name}"
