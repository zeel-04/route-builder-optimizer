'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { z } from 'zod'
import { ApiError, apiFetch, validationErrors } from '@/lib/client'
import { projectCreateSchema, projectSchema } from './schema'
import type { CreateProjectState } from './types'

export async function listProjects() {
  return apiFetch('/projects/', z.array(projectSchema))
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
