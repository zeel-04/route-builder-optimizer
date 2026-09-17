/**
 * Sign-in failures travel back to /login as a code, never as free text — a
 * `?error=` the caller controls would render attacker-written copy in the
 * login page's error banner.
 */
export const SSO_ERRORS = {
  failed: "We couldn't sign you in. Try again.",
  expired: 'Your sign-in request expired. Try again.',
  not_provisioned: "This account isn't set up for Route Builder. Contact your administrator.",
} as const

export type SsoErrorCode = keyof typeof SSO_ERRORS

export function ssoErrorMessage(code?: string) {
  return code && code in SSO_ERRORS ? SSO_ERRORS[code as SsoErrorCode] : undefined
}
