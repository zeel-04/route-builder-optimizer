import { z } from 'zod'

export const userSchema = z.object({
  id: z.string(),
  email: z.string(),
  name: z.string(),
  tenant: z.object({ id: z.string(), name: z.string() }),
})

export const loginResponseSchema = z.object({
  token: z.string(),
  user: userSchema,
})

export const loginInputSchema = z.object({
  email: z.email('Enter a valid email address.'),
  password: z.string().min(1, 'Enter your password.'),
})
