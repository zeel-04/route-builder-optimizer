from django.conf import settings
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from api.accounts.serializers.auth_serializers import (
    AuthLoginInputSerializer,
    AuthLoginOutputSerializer,
    AuthSSOLoginInputSerializer,
    UserOutputSerializer,
)
from api.accounts.services.auth_services import (
    AuthLoginService,
    AuthLogoutService,
    AuthSSOLoginService,
)
from api.core.exceptions import ApplicationError

PASSWORD_LOGIN_DISABLED = "Password sign-in is disabled. Use single sign-on."
SSO_DISABLED = "Single sign-on is not enabled."


class AuthLoginView(APIView):
    authentication_classes = []
    permission_classes = [AllowAny]

    def post(self, request):
        if settings.SSO_ENABLED:
            raise ApplicationError(PASSWORD_LOGIN_DISABLED)

        serializer = AuthLoginInputSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        token = AuthLoginService().execute(**serializer.validated_data)
        output = AuthLoginOutputSerializer({"token": token.key, "user": token.user})
        return Response(output.data)


class AuthSSOView(APIView):
    authentication_classes = []
    permission_classes = [AllowAny]

    def post(self, request):
        if not settings.SSO_ENABLED:
            raise ApplicationError(SSO_DISABLED)

        serializer = AuthSSOLoginInputSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        token = AuthSSOLoginService().execute(**serializer.validated_data)
        output = AuthLoginOutputSerializer({"token": token.key, "user": token.user})
        return Response(output.data)


class AuthLogoutView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        AuthLogoutService().execute(user=request.user)
        return Response(status=204)


class AuthMeView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        return Response(UserOutputSerializer(request.user).data)
