import 'server-only'
import { cache } from 'react'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'

export const SESSION_COOKIE = 'session'

export const SESSION_COOKIE_OPTIONS = {
  httpOnly: true,
  sameSite: 'lax',
  secure: process.env.NODE_ENV === 'production',
  path: '/',
} as const

/** The authoritative session check. Every backend call runs through it. */
export const verifySession = cache(async () => {
  const token = (await cookies()).get(SESSION_COOKIE)?.value
  if (!token) redirect('/login')
  return { token }
})
