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
      'Content-Type': 'application/json',
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

/** Unauthenticated call. Only sign-in needs it. */
export async function apiFetchPublic<T>(
  path: string,
  schema: z.ZodType<T>,
  init?: RequestInit,
): Promise<T> {
  return request(path, schema, init)
}
