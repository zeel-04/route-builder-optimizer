'use server'

import { ApiError, apiFetch } from '@/lib/client'
import { placeSchema } from './schema'
import type { PlaceQuery } from './types'

/** Geocodes a place for the explore map. Resolves to null when nothing matches. */
export async function searchPlace(query: PlaceQuery) {
  try {
    return await apiFetch(`/places/search/?${new URLSearchParams(query)}`, placeSchema)
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) return null
    throw err
  }
}
