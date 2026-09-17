import 'server-only'

export const STATE_COOKIE = 'oidc_state'
export const VERIFIER_COOKIE = 'oidc_verifier'

/** Short-lived: the user has 10 minutes to finish signing in at the IdP. */
export const OIDC_COOKIE_OPTIONS = {
  httpOnly: true,
  sameSite: 'lax',
  secure: process.env.NODE_ENV === 'production',
  path: '/',
  maxAge: 600,
} as const

export function base64url(bytes: ArrayBuffer | Uint8Array) {
  return Buffer.from(bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes)).toString('base64url')
}
