import { NextResponse, type NextRequest } from 'next/server'
import { ApiError, apiFetchPublic } from '@/lib/client'
import { SESSION_COOKIE, SESSION_COOKIE_OPTIONS } from '@/lib/dal'
import { OIDC_REDIRECT_URI, oidcConfig, ssoEnabled } from '@/lib/features/auth/oidc'
import { OIDC_COOKIE_OPTIONS, STATE_COOKIE, VERIFIER_COOKIE } from '@/lib/features/auth/pkce'
import { loginResponseSchema, tokenResponseSchema } from '@/lib/features/auth/schema'
import type { SsoErrorCode } from '@/lib/features/auth/sso-errors'

/** Redirects, clearing the one-shot PKCE cookies whichever way the flow ended. */
function redirectTo(req: NextRequest, path: string) {
  const res = NextResponse.redirect(new URL(path, req.url))
  // The path must match the one they were set with, or the browser keeps them.
  for (const name of [STATE_COOKIE, VERIFIER_COOKIE]) {
    res.cookies.delete({ name, path: OIDC_COOKIE_OPTIONS.path })
  }
  return res
}

function toLogin(req: NextRequest, code: SsoErrorCode) {
  return redirectTo(req, `/login?error=${code}`)
}

export async function GET(req: NextRequest) {
  if (!ssoEnabled) return new NextResponse('Not found', { status: 404 })

  const state = req.cookies.get(STATE_COOKIE)?.value
  const verifier = req.cookies.get(VERIFIER_COOKIE)?.value
  const params = req.nextUrl.searchParams

  if (params.get('error')) return toLogin(req, 'failed')

  const code = params.get('code')
  if (!code || !verifier || !state || params.get('state') !== state) {
    return toLogin(req, 'expired')
  }

  const { token_endpoint } = await oidcConfig()
  const res = await fetch(token_endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: OIDC_REDIRECT_URI,
      client_id: process.env.OIDC_CLIENT_ID!,
      client_secret: process.env.OIDC_CLIENT_SECRET!,
      code_verifier: verifier,
    }),
  })
  if (!res.ok) return toLogin(req, 'failed')

  // A 200 that isn't the token payload (wrong scopes, an HTML error page) must
  // still land the user back on /login, not on a 500.
  const parsed = tokenResponseSchema.safeParse(await res.json().catch(() => null))
  if (!parsed.success) return toLogin(req, 'failed')

  let token: string
  try {
    ;({ token } = await apiFetchPublic('/auth/sso/', loginResponseSchema, {
      method: 'POST',
      body: JSON.stringify({ id_token: parsed.data.id_token }),
    }))
  } catch (err) {
    // The backend rejects unknown, inactive, and tenant-less users by design.
    if (err instanceof ApiError) return toLogin(req, 'not_provisioned')
    throw err
  }

  const done = redirectTo(req, '/projects')
  done.cookies.set(SESSION_COOKIE, token, SESSION_COOKIE_OPTIONS)
  return done
}
