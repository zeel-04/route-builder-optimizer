import type { z } from 'zod'
import type { loginInputSchema, userSchema } from './schema'

export type User = z.infer<typeof userSchema>
export type LoginInput = z.infer<typeof loginInputSchema>
