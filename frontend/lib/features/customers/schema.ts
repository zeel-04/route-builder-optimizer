import { z } from 'zod'
import { LocationAccuracy } from './types'

export const routeRefSchema = z.object({
  id: z.string(),
  name: z.string(),
  color: z.string(),
})

export const customerSchema = z.object({
  id: z.string(),
  customer_code: z.string(),
  name: z.string(),
  address: z.string(),
  address2: z.string(),
  city: z.string(),
  county: z.string(),
  state: z.string(),
  zipcode: z.string(),
  latitude: z.number().nullable(),
  longitude: z.number().nullable(),
  // "" until the customer has been geocoded
  location_accuracy: z.enum([...Object.values(LocationAccuracy), '']),
  // no pin yet because the lookup hasn't run; false once it was tried, found or not
  is_geocode_pending: z.boolean(),
  route: routeRefSchema.nullable(),
})

export const customerPageSchema = z.object({
  count: z.number(),
  next: z.string().nullable(),
  previous: z.string().nullable(),
  results: z.array(customerSchema),
})

export const filterOptionsSchema = z.object({
  states: z.array(z.string()),
  counties: z.array(z.string()),
  cities: z.array(z.string()),
})

export const customerCreateSchema = z.object({
  customer_code: z.string().trim().min(1, 'Enter a customer code.'),
  name: z.string().trim().min(1, 'Enter a name.'),
  address: z.string().trim().min(1, 'Enter a street address.'),
  address2: z.string().trim().default(''),
  state: z
    .string()
    .trim()
    .regex(/^[A-Za-z]{2}$/, 'Enter the 2-letter state code, like TX.')
    .transform((s) => s.toUpperCase()),
  zipcode: z.string().trim().min(1, 'Enter a ZIP code.'),
})

export const customerUploadSchema = z.object({
  file: z
    .instanceof(File, { message: 'Choose a CSV file.' })
    .refine((f) => f.size > 0, 'The file is empty.')
    .refine((f) => f.name.toLowerCase().endsWith('.csv'), 'Choose a .csv file.'),
})

export const uploadResultSchema = z.object({
  created: z.number(),
  updated: z.number(),
  total: z.number(),
})
