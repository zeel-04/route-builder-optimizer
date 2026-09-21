'use server'

import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { z } from 'zod'
import { ApiError, apiFetch, apiFetchPublic } from '@/lib/client'
import { SESSION_COOKIE, SESSION_COOKIE_OPTIONS, verifySession } from '@/lib/dal'
import { ID_TOKEN_COOKIE, oidcConfig, ssoEnabled } from './oidc'
import { loginInputSchema, loginResponseSchema, userSchema } from './schema'

export async function getMe() {
  return apiFetch('/auth/me/', userSchema)
}

export type LoginState = {
  message?: string
  errors?: Record<string, string[] | undefined>
} | null

export async function loginAction(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const parsed = loginInputSchema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) return { errors: z.flattenError(parsed.error).fieldErrors }

  let token: string
  try {
    ;({ token } = await apiFetchPublic('/auth/login/', loginResponseSchema, {
      method: 'POST',
      body: JSON.stringify(parsed.data),
    }))
  } catch (err) {
    if (err instanceof ApiError && err.status === 400) return { message: err.message }
    throw err
  }

  ;(await cookies()).set(SESSION_COOKIE, token, SESSION_COOKIE_OPTIONS)
  redirect('/projects')
}

export async function logoutAction() {
  const { token } = await verifySession()
  try {
    await apiFetchPublic('/auth/logout/', z.void(), {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
    })
  } catch (err) {
    if (!(err instanceof ApiError)) throw err // token already dead: still clear the cookie
  }
  const jar = await cookies()
  const idToken = jar.get(ID_TOKEN_COOKIE)?.value
  jar.delete(SESSION_COOKIE)
  jar.delete(ID_TOKEN_COOKIE)
  if (!ssoEnabled) redirect('/login')

  // End the IdP session too, otherwise the next sign-in silently re-authenticates.
  const { end_session_endpoint } = await oidcConfig()
  // The IdP answers 400 to a post-logout redirect without id_token_hint. A session
  // from before the ID token was kept has none: end the IdP session without the
  // redirect rather than strand the user on an error page.
  const params = new URLSearchParams(
    idToken ? { id_token_hint: idToken, post_logout_redirect_uri: `${process.env.APP_URL}/login` } : {},
  )
  redirect(params.size ? `${end_session_endpoint}?${params}` : end_session_endpoint)
}
