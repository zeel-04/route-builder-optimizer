import uuid

from django.db import models
from django.utils import timezone


class BaseModel(models.Model):
    # ponytail: data-models.md uses UUID PKs throughout, not Django's default
    # BigAutoField — putting the PK here too instead of repeating it per model.
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    created_at = models.DateTimeField(db_index=True, default=timezone.now)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        abstract = True
