from django.db import models

from api.accounts.models import Tenant
from api.core.models import BaseModel
from api.projects.models import Project


class Customer(BaseModel):
    class LocationAccuracy(models.TextChoices):
        STREET = "street", "Street"
        ZIP = "zip", "ZIP"

    tenant = models.ForeignKey(Tenant, on_delete=models.CASCADE, related_name="customers")
    project = models.ForeignKey(Project, on_delete=models.CASCADE, related_name="customers")
    customer_code = models.CharField(max_length=50)
    name = models.CharField(max_length=255)
    address = models.CharField(max_length=255)
    address2 = models.CharField(max_length=255, blank=True)
    city = models.CharField(max_length=100, blank=True)
    county = models.CharField(max_length=100, blank=True)
    state = models.CharField(max_length=2)
    zipcode = models.CharField(max_length=10)
    latitude = models.DecimalField(max_digits=9, decimal_places=6, null=True, blank=True)
    longitude = models.DecimalField(max_digits=9, decimal_places=6, null=True, blank=True)
    location_accuracy = models.CharField(
        max_length=10, choices=LocationAccuracy.choices, blank=True
    )
    geocode_attempted_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=["project", "customer_code"], name="unique_project_customer_code"
            )
        ]
        indexes = [
            models.Index(fields=["project", "state"], name="customer_project_state_idx"),
            models.Index(fields=["project", "county"], name="customer_project_county_idx"),
            models.Index(fields=["project", "city"], name="customer_project_city_idx"),
            models.Index(fields=["project", "zipcode"], name="customer_project_zip_idx"),
        ]

    def __str__(self):
        return f"{self.customer_code} — {self.name}"
