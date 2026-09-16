import { z } from 'zod'

export const projectSchema = z.object({
  id: z.string(),
  name: z.string(),
  customer_count: z.number(),
  route_count: z.number(),
  created_at: z.string(),
  updated_at: z.string(),
})
