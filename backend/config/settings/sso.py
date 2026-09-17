from config.env import env, validate_env

SSO_ENABLED = env.bool("SSO_ENABLED", default=False)

# Only required when SSO is switched on — non-SSO deployments keep booting
# without these set.
if SSO_ENABLED:
    validate_env(["OIDC_DISCOVERY_URL", "OIDC_CLIENT_ID"])

OIDC_DISCOVERY_URL = env("OIDC_DISCOVERY_URL", default="")
OIDC_CLIENT_ID = env("OIDC_CLIENT_ID", default="")
