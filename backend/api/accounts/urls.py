from django.urls import path

from api.accounts.views.auth_view import AuthLoginView, AuthLogoutView, AuthMeView, AuthSSOView

urlpatterns = [
    path("auth/login/", AuthLoginView.as_view(), name="auth-login"),
    path("auth/sso/", AuthSSOView.as_view(), name="auth-sso"),
    path("auth/logout/", AuthLogoutView.as_view(), name="auth-logout"),
    path("auth/me/", AuthMeView.as_view(), name="auth-me"),
]
