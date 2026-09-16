import { z } from 'zod'
import { customerSchema } from '@/lib/features/customers/schema'

export const routeSchema = z.object({
  id: z.string(),
  project_id: z.string(),
  name: z.string(),
  color: z.string(),
  stop_count: z.number(),
  created_by: z.object({ id: z.string(), name: z.string(), email: z.string() }).nullable(),
  created_at: z.string(),
  updated_at: z.string(),
})

export const routeStopSchema = z.object({
  sequence: z.number(),
  customer: customerSchema.omit({ route: true }),
})

export const routeDetailSchema = routeSchema.extend({
  stops: z.array(routeStopSchema),
})

export const routeWriteSchema = z.object({
  project: z.string(), // ignored by the API on PATCH
  name: z.string().trim().min(1, 'Enter a route name.').max(255, 'Use a shorter name.'),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/, 'Pick a color.'),
  customer_ids: z.array(z.string()).min(1, 'Add at least one stop from the map.'),
})
