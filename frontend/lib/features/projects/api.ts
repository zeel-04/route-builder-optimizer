'use server'

import { z } from 'zod'
import { apiFetch } from '@/lib/client'
import { projectSchema } from './schema'

export async function listProjects() {
  return apiFetch('/projects/', z.array(projectSchema))
}

export async function getProject(id: string) {
  return apiFetch(`/projects/${id}/`, projectSchema)
}
