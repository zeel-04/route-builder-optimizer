from functools import lru_cache

import httpx
import jwt
from django.conf import settings
from django.contrib.auth import authenticate
from django.db import transaction
from loguru import logger
from rest_framework.authtoken.models import Token

from api.accounts.models import User
from api.core.exceptions import ApplicationError

INVALID_CREDENTIALS = "Invalid email or password."
INVALID_SSO_TOKEN = "Could not verify your single sign-on session. Please sign in again."
NOT_PROVISIONED = (
    "This account is not provisioned for Route Builder. Contact your administrator."
)


class OIDCConfigurationError(Exception):
    """The IdP's discovery document is unusable — a deployment problem, not a bad token."""


@lru_cache(maxsize=1)
def _discovery() -> dict:
    """OIDC discovery document — fetched once per process."""
    response = httpx.get(settings.OIDC_DISCOVERY_URL, timeout=10)
    response.raise_for_status()
    document = response.json()
    # A JSON error page would otherwise be cached and KeyError on every later
    # login; raising here caches nothing, so the next attempt refetches.
    missing = [key for key in ("issuer", "jwks_uri") if key not in document]
    if missing:
        raise OIDCConfigurationError(f"discovery document missing: {', '.join(missing)}")
    return document


@lru_cache(maxsize=1)
def _jwk_client(jwks_uri: str) -> jwt.PyJWKClient:
    # PyJWKClient caches signing keys itself; keep one per process.
    return jwt.PyJWKClient(jwks_uri, timeout=10)


def _verify_id_token(id_token: str) -> dict:
    document = _discovery()
    signing_key = _jwk_client(document["jwks_uri"]).get_signing_key_from_jwt(id_token)
    return jwt.decode(
        id_token,
        signing_key.key,
        algorithms=["RS256"],
        audience=settings.OIDC_CLIENT_ID,
        issuer=document["issuer"],
        options={"require": ["exp"]},
    )


class AuthLoginService:
    @transaction.atomic
    def execute(self, *, email: str, password: str) -> Token:
        user = authenticate(username=email, password=password)
        if user is None or not user.tenant_id:
            raise ApplicationError(INVALID_CREDENTIALS)
        token, _ = Token.objects.get_or_create(user=user)
        logger.info("user logged in", user_id=str(user.id), tenant_id=str(user.tenant_id))
        return token


class AuthSSOLoginService:
    """Verifies an Authentik-issued ID token and signs in a pre-provisioned user.
    Never creates users — an unknown email is rejected."""

    # No @transaction.atomic: token verification talks to the IdP over the
    # network, and the only write is a single get_or_create.
    def execute(self, *, id_token: str) -> Token:
        try:
            claims = _verify_id_token(id_token)
        except (jwt.PyJWTError, httpx.HTTPError, OIDCConfigurationError) as exc:
            logger.warning("sso token verification failed", error=str(exc))
            raise ApplicationError(INVALID_SSO_TOKEN) from exc

        email = claims.get("email")
        if not email:
            logger.warning("sso token missing email claim", subject=claims.get("sub"))
            raise ApplicationError(INVALID_SSO_TOKEN)

        try:
            user = User.objects.get(email__iexact=email)
        except User.DoesNotExist:
            logger.warning("sso login for unknown user", email=email)
            raise ApplicationError(NOT_PROVISIONED) from None

        if not user.is_active or not user.tenant_id:
            logger.warning(
                "sso login for unprovisioned user",
                user_id=str(user.id),
                is_active=user.is_active,
            )
            raise ApplicationError(NOT_PROVISIONED)

        token, _ = Token.objects.get_or_create(user=user)
        logger.info("user logged in via sso", user_id=str(user.id), tenant_id=str(user.tenant_id))
        return token


class AuthLogoutService:
    @transaction.atomic
    def execute(self, *, user) -> None:
        Token.objects.filter(user=user).delete()
        logger.info("user logged out", user_id=str(user.id))
