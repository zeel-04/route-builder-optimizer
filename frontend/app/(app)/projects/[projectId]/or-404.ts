import { notFound } from 'next/navigation'
import { ApiError } from '@/lib/client'

/**
 * Every read on these pages is scoped by an id from the URL, so a 404 from any of them
 * means the URL points at nothing. Wrapping the whole Promise.all keeps that deterministic
 * (a project 404 also 404s its customers and routes, and any of them may reject first).
 */
export async function or404<T>(reads: Promise<T>): Promise<T> {
  try {
    return await reads
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) notFound()
    throw err
  }
}
