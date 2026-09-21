import type { z } from 'zod'
import type { projectCreateSchema, projectSchema } from './schema'

export type Project = z.infer<typeof projectSchema>
export type ProjectCreate = z.infer<typeof projectCreateSchema>

export type CreateProjectState = { message?: string; errors?: Partial<Record<string, string[]>> } | null

export const PROJECT_PAGE_SIZE = 25
