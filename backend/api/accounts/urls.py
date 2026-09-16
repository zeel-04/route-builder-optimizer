from django.urls import path

from api.accounts.views.auth_view import AuthLoginView, AuthLogoutView, AuthMeView

urlpatterns = [
    path("auth/login/", AuthLoginView.as_view(), name="auth-login"),
    path("auth/logout/", AuthLogoutView.as_view(), name="auth-logout"),
    path("auth/me/", AuthMeView.as_view(), name="auth-me"),
]
