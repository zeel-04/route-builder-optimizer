import 'server-only'
import { redirect } from 'next/navigation'
import { z } from 'zod'
import { verifySession } from '@/lib/dal'

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public extra: Record<string, unknown> = {},
  ) {
    super(message)
  }
}

const errorBodySchema = z.object({
  message: z.string(),
  extra: z.record(z.string(), z.unknown()).default({}),
})

async function request<T>(
  path: string,
  schema: z.ZodType<T>,
  init?: RequestInit,
  token?: string,
): Promise<T> {
  const res = await fetch(`${process.env.API_URL}${path}`, {
    ...init,
    headers: {
      // FormData bodies need fetch to set the multipart boundary itself.
      ...(init?.body instanceof FormData ? {} : { 'Content-Type': 'application/json' }),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...init?.headers,
    },
  })

  if (!res.ok) {
    const body = errorBodySchema.safeParse(await res.json().catch(() => null))
    throw new ApiError(
      res.status,
      body.success ? body.data.message : res.statusText,
      body.success ? body.data.extra : {},
    )
  }
  if (res.status === 204) return schema.parse(undefined)
  return schema.parse(await res.json()) // contract drift fails loudly, here
}

/** Authenticated call. Every read and mutation goes through this. */
export async function apiFetch<T>(
  path: string,
  schema: z.ZodType<T>,
  init?: RequestInit,
): Promise<T> {
  const { token } = await verifySession()
  try {
    return await request(path, schema, init, token)
  } catch (err) {
    if (err instanceof ApiError && err.status === 401) redirect('/login')
    throw err
  }
}

/** Authenticated call that hands back the raw response, for non-JSON bodies like file downloads. */
export async function apiFetchRaw(path: string): Promise<Response> {
  const { token } = await verifySession()
  const res = await fetch(`${process.env.API_URL}${path}`, { headers: { Authorization: `Bearer ${token}` } })
  if (res.status === 401) redirect('/login')
  if (!res.ok) throw new ApiError(res.status, res.statusText)
  return res
}

/** Proxies a backend file download so the token never reaches the browser. */
export async function proxyDownload(path: string): Promise<Response> {
  try {
    const res = await apiFetchRaw(path)
    const headers = new Headers()
    for (const name of ['Content-Type', 'Content-Disposition']) {
      const value = res.headers.get(name)
      if (value) headers.set(name, value)
    }
    return new Response(res.body, { headers })
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) return new Response('Not found', { status: 404 })
    throw err
  }
}

/** Unauthenticated call. Only sign-in needs it. */
export async function apiFetchPublic<T>(
  path: string,
  schema: z.ZodType<T>,
  init?: RequestInit,
): Promise<T> {
  return request(path, schema, init)
}

const validationExtraSchema = z.object({
  fields: z.record(z.string(), z.array(z.string())),
})

/**
 * Splits a DRF validation 400 (`extra.fields`) into per-field errors for the form's own
 * fields and one form-level message for everything else (non_field_errors, unknown keys).
 */
export function validationErrors(err: ApiError, formFields: readonly string[]) {
  const parsed = validationExtraSchema.safeParse(err.extra)
  const errors: Record<string, string[]> = {}
  const other: string[] = []
  for (const [key, messages] of Object.entries(parsed.success ? parsed.data.fields : {})) {
    if (formFields.includes(key)) errors[key] = messages
    else other.push(...messages)
  }
  const message = other.join(' ') || (Object.keys(errors).length ? undefined : err.message)
  return { message, errors }
}
