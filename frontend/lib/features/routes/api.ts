'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { ApiError, apiFetch } from '@/lib/client'
import { routeDetailSchema, routeSchema, routeWriteSchema } from './schema'
import type { SaveRouteResult } from './types'

export async function listRoutes(projectId: string) {
  return apiFetch(`/routes/?${new URLSearchParams({ project: projectId })}`, z.array(routeSchema))
}

export async function getRoute(id: string) {
  return apiFetch(`/routes/${id}/`, routeDetailSchema)
}

export async function saveRouteAction(id: string | null, input: unknown): Promise<SaveRouteResult> {
  const parsed = routeWriteSchema.safeParse(input) // actions are public endpoints
  if (!parsed.success) {
    const fieldErrors = z.flattenError(parsed.error).fieldErrors
    return {
      ok: false,
      message: Object.values(fieldErrors).flat()[0] ?? 'Check the route details.',
      fieldErrors,
    }
  }

  try {
    const route = await apiFetch(id ? `/routes/${id}/` : '/routes/', routeDetailSchema, {
      method: id ? 'PATCH' : 'POST',
      body: JSON.stringify(parsed.data),
    })
    revalidatePath('/', 'layout')
    return { ok: true, id: route.id }
  } catch (err) {
    if (err instanceof ApiError && err.status === 400) {
      const ids = err.extra.customer_ids
      return {
        ok: false,
        message: err.message,
        customerIds: Array.isArray(ids) ? ids.map(String) : undefined,
      }
    }
    throw err
  }
}

export async function deleteRouteAction(id: string) {
  await apiFetch(`/routes/${id}/`, z.void(), { method: 'DELETE' })
  revalidatePath('/', 'layout')
}
