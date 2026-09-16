import type { z } from 'zod'
import type { projectSchema } from './schema'

export type Project = z.infer<typeof projectSchema>
