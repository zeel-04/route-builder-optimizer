'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { z } from 'zod'
import { ApiError, apiFetch, validationErrors } from '@/lib/client'
import { projectCreateSchema, projectPageSchema, projectSchema } from './schema'
import { PROJECT_PAGE_SIZE, type CreateProjectState } from './types'

export async function listProjects(page: number, search = '') {
  const params = new URLSearchParams({ page: String(page), page_size: String(PROJECT_PAGE_SIZE) })
  if (search) params.set('search', search)
  return apiFetch(`/projects/?${params}`, projectPageSchema)
}

export async function getProject(id: string) {
  return apiFetch(`/projects/${id}/`, projectSchema)
}

export async function createProjectAction(_prev: CreateProjectState, formData: FormData): Promise<CreateProjectState> {
  const parsed = projectCreateSchema.safeParse(Object.fromEntries(formData)) // actions are public endpoints
  if (!parsed.success) return { errors: z.flattenError(parsed.error).fieldErrors }

  let project
  try {
    project = await apiFetch('/projects/', projectSchema, { method: 'POST', body: JSON.stringify(parsed.data) })
  } catch (err) {
    if (err instanceof ApiError && err.status === 400) return validationErrors(err, ['name'])
    throw err
  }
  revalidatePath('/projects')
  redirect(`/projects/${project.id}`)
}

/** Bound to a project id by the rename form; `null` back means it saved. */
export async function renameProjectAction(id: string, _prev: CreateProjectState, formData: FormData): Promise<CreateProjectState> {
  const parsed = projectCreateSchema.safeParse(Object.fromEntries(formData)) // actions are public endpoints
  if (!parsed.success) return { errors: z.flattenError(parsed.error).fieldErrors }

  try {
    await apiFetch(`/projects/${id}/`, projectSchema, { method: 'PATCH', body: JSON.stringify(parsed.data) })
  } catch (err) {
    if (err instanceof ApiError && err.status === 400) return validationErrors(err, ['name'])
    throw err
  }
  revalidatePath('/', 'layout') // the name shows on every page under the project
  return null
}

export async function deleteProjectAction(id: string) {
  await apiFetch(`/projects/${id}/`, z.void(), { method: 'DELETE' })
  revalidatePath('/', 'layout')
}
