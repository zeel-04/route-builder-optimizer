from django.contrib.auth.models import AbstractUser, BaseUserManager
from django.db import models
from django.db.models import Q

from api.core.models import BaseModel


class Tenant(BaseModel):
    name = models.CharField(max_length=255, unique=True)

    def __str__(self):
        return self.name


class UserManager(BaseUserManager):
    use_in_migrations = True

    @classmethod
    def normalize_email(cls, email):
        # Django only lowercases the domain; lowercase the whole address so
        # `unique=True` on email is case-insensitive in practice.
        return super().normalize_email(email).lower()

    def get_by_natural_key(self, email):
        # Case-insensitive login — used by authenticate() for both the API
        # and the admin.
        return self.get(email__iexact=email)

    def _create_user(self, email, password, **extra_fields):
        if not email:
            raise ValueError("Users must have an email address.")
        email = self.normalize_email(email)
        user = self.model(email=email, **extra_fields)
        user.set_password(password)
        user.save(using=self._db)
        return user

    def create_user(self, email, password=None, **extra_fields):
        extra_fields.setdefault("is_staff", False)
        extra_fields.setdefault("is_superuser", False)
        return self._create_user(email, password, **extra_fields)

    def create_superuser(self, email, password=None, **extra_fields):
        extra_fields.setdefault("is_staff", True)
        extra_fields.setdefault("is_superuser", True)
        return self._create_user(email, password, **extra_fields)


class User(AbstractUser, BaseModel):
    # Plan note: "inherit the user and create a custom user model so that we
    # can modify the properties of the user down the line" — subclasses
    # AbstractUser (Django's own recipe for this) rather than starting from
    # AbstractBaseUser, and drops username in favor of email from day one.
    # BaseModel supplies the UUID pk plus created_at/updated_at.
    username = None
    first_name = None
    last_name = None
    email = models.EmailField(unique=True)
    name = models.CharField(max_length=255, blank=True)
    tenant = models.ForeignKey(
        Tenant, on_delete=models.PROTECT, related_name="users", null=True, blank=True
    )

    objects = UserManager()

    USERNAME_FIELD = "email"
    REQUIRED_FIELDS = []

    class Meta:
        constraints = [
            models.CheckConstraint(
                name="superuser_or_has_tenant",
                condition=Q(is_superuser=True) | Q(tenant__isnull=False),
            )
        ]

    def __str__(self):
        return self.email
