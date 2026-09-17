import { NextResponse, type NextRequest } from 'next/server'

// Optimistic redirect only. verifySession() in lib/dal.ts is the real gate.
export function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl
  // /api/auth/* is the SSO handshake — it runs before a session exists.
  if (pathname.startsWith('/login') || pathname.startsWith('/api/auth/')) return NextResponse.next()
  if (!req.cookies.has('session')) {
    return NextResponse.redirect(new URL('/login', req.url))
  }
  return NextResponse.next()
}

export const config = { matcher: ['/((?!_next|favicon.ico).*)'] }
