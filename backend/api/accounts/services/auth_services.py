from django.contrib.auth import authenticate
from django.db import transaction
from loguru import logger
from rest_framework.authtoken.models import Token

from api.core.exceptions import ApplicationError

INVALID_CREDENTIALS = "Invalid email or password."


class AuthLoginService:
    @transaction.atomic
    def execute(self, *, email: str, password: str) -> Token:
        user = authenticate(username=email, password=password)
        if user is None or not user.tenant_id:
            raise ApplicationError(INVALID_CREDENTIALS)
        token, _ = Token.objects.get_or_create(user=user)
        logger.info("user logged in", user_id=str(user.id), tenant_id=str(user.tenant_id))
        return token


class AuthLogoutService:
    @transaction.atomic
    def execute(self, *, user) -> None:
        Token.objects.filter(user=user).delete()
        logger.info("user logged out", user_id=str(user.id))
