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
  route: routeRefSchema.nullable(),
})

export const filterOptionsSchema = z.object({
  states: z.array(z.string()),
  counties: z.array(z.string()),
  cities: z.array(z.string()),
})
