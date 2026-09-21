import { z } from 'zod'

export const projectSchema = z.object({
  id: z.string(),
  name: z.string(),
  customer_count: z.number(),
  route_count: z.number(),
  created_at: z.string(),
  updated_at: z.string(),
})

export const projectPageSchema = z.object({
  count: z.number(),
  next: z.string().nullable(),
  previous: z.string().nullable(),
  results: z.array(projectSchema),
})

export const projectCreateSchema = z.object({
  name: z.string().trim().min(1, 'Enter a project name.').max(200, 'Keep the name under 200 characters.'),
})
