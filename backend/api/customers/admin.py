from django.contrib import admin

from api.customers.models import Customer


@admin.register(Customer)
class CustomerAdmin(admin.ModelAdmin):
    list_display = (
        "customer_code", "name", "state", "city", "location_accuracy", "project", "tenant"
    )
    list_filter = ("tenant", "project", "state", "location_accuracy")
    search_fields = ("customer_code", "name", "address", "zipcode")
