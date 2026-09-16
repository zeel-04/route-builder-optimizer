import { z } from 'zod'

export const placeSchema = z.object({
  latitude: z.number(),
  longitude: z.number(),
  label: z.string(),
})
