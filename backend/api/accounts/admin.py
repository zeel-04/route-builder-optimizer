from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as DjangoUserAdmin
from django.contrib.auth.forms import UserChangeForm, UserCreationForm

from api.accounts.models import Tenant, User


@admin.register(Tenant)
class TenantAdmin(admin.ModelAdmin):
    list_display = ("name", "created_at")
    search_fields = ("name",)


class UserCreationFormWithFields(UserCreationForm):
    # is_superuser has to be on the form, otherwise Django skips validating
    # the superuser_or_has_tenant constraint and a missing tenant is a 500.
    class Meta(UserCreationForm.Meta):
        model = User
        fields = ("email", "name", "tenant", "is_superuser")


class UserChangeFormWithFields(UserChangeForm):
    class Meta(UserChangeForm.Meta):
        model = User
        fields = "__all__"


@admin.register(User)
class UserAdmin(DjangoUserAdmin):
    add_form = UserCreationFormWithFields
    form = UserChangeFormWithFields
    model = User
    ordering = ("email",)
    list_display = ("email", "name", "tenant", "is_staff", "is_active")
    list_filter = ("tenant", "is_staff", "is_active", "is_superuser")
    search_fields = ("email", "name")
    fieldsets = (
        (None, {"fields": ("email", "password")}),
        ("Personal info", {"fields": ("name", "tenant")}),
        (
            "Permissions",
            {"fields": ("is_active", "is_staff", "is_superuser", "groups", "user_permissions")},
        ),
        ("Important dates", {"fields": ("last_login", "date_joined")}),
    )
    add_fieldsets = (
        (
            None,
            {
                "classes": ("wide",),
                "fields": ("email", "name", "tenant", "is_superuser", "password1", "password2"),
            },
        ),
    )
