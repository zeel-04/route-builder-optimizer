import 'server-only'
import { z } from 'zod'

export const ssoEnabled = process.env.SSO_ENABLED === 'true'

// Mirrors the backend's validate_env: without this, a missing APP_URL only
// shows up as a redirect_uri of "undefined/api/auth/..." rejected by the IdP.
if (ssoEnabled) {
  const missing = ['APP_URL', 'OIDC_DISCOVERY_URL', 'OIDC_CLIENT_ID', 'OIDC_CLIENT_SECRET'].filter(
    (name) => !process.env[name],
  )
  if (missing.length) throw new Error(`SSO_ENABLED is on but missing: ${missing.join(', ')}`)
}

/**
 * The ID token from sign-in, kept only to hand back at sign-out: the IdP refuses
 * a post-logout redirect (400) unless `id_token_hint` names who is leaving.
 */
export const ID_TOKEN_COOKIE = 'id_token'

/** Registered with the IdP. Changing this path breaks the flow. */
export const OIDC_REDIRECT_URI = `${process.env.APP_URL}/api/auth/callback/authentik`

const discoverySchema = z.object({
  authorization_endpoint: z.url(),
  token_endpoint: z.url(),
  end_session_endpoint: z.url(),
})

let cached: Promise<z.infer<typeof discoverySchema>> | undefined

/** The IdP's discovery document, fetched once per server process. */
export function oidcConfig() {
  cached ??= (async () => {
    const res = await fetch(process.env.OIDC_DISCOVERY_URL!)
    if (!res.ok) throw new Error(`OIDC discovery failed: ${res.status}`)
    return discoverySchema.parse(await res.json())
  })().catch((err: unknown) => {
    cached = undefined // don't cache a failure — the IdP may just be restarting
    throw err
  })
  return cached
}
