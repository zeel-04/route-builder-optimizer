import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import { OIDC_REDIRECT_URI, oidcConfig, ssoEnabled } from '@/lib/features/auth/oidc'
import { OIDC_COOKIE_OPTIONS, STATE_COOKIE, VERIFIER_COOKIE, base64url } from '@/lib/features/auth/pkce'

export async function GET() {
  if (!ssoEnabled) return new NextResponse('Not found', { status: 404 })

  const state = base64url(crypto.getRandomValues(new Uint8Array(32)))
  const verifier = base64url(crypto.getRandomValues(new Uint8Array(32)))
  const challenge = base64url(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier)))

  const jar = await cookies()
  jar.set(STATE_COOKIE, state, OIDC_COOKIE_OPTIONS)
  jar.set(VERIFIER_COOKIE, verifier, OIDC_COOKIE_OPTIONS)

  const { authorization_endpoint } = await oidcConfig()
  const params = new URLSearchParams({
    response_type: 'code',
    scope: 'openid email profile',
    client_id: process.env.OIDC_CLIENT_ID!,
    redirect_uri: OIDC_REDIRECT_URI,
    state,
    code_challenge: challenge,
    code_challenge_method: 'S256',
  })
  return NextResponse.redirect(`${authorization_endpoint}?${params}`)
}
