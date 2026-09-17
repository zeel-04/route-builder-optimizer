import type { z } from 'zod'
import type {
  customerCreateSchema,
  customerSchema,
  filterOptionsSchema,
  routeRefSchema,
  uploadResultSchema,
} from './schema'

export const LocationAccuracy = { STREET: 'street', ZIP: 'zip' } as const
export type LocationAccuracy = (typeof LocationAccuracy)[keyof typeof LocationAccuracy]

export type Customer = z.infer<typeof customerSchema>
export type RouteRef = z.infer<typeof routeRefSchema>
export type FilterOptions = z.infer<typeof filterOptionsSchema>
export const CUSTOMER_PAGE_SIZE = 50

export type CustomerCreate = z.infer<typeof customerCreateSchema>
export type UploadResult = z.infer<typeof uploadResultSchema>

export type AddCustomerState =
  | { ok: true }
  | { ok: false; message?: string; errors?: Partial<Record<string, string[]>> }
  | null
export type UploadState = ({ ok: true } & UploadResult) | { ok: false; message: string; details: string[] } | null

export type CustomerFilters = {
  state: string
  county: string
  city: string
  search: string
}

export type Pinned = { latitude: number; longitude: number }
export type PinnedCustomer = Customer & Pinned

export function hasPin<T extends { latitude: number | null; longitude: number | null }>(
  customer: T,
): customer is T & Pinned {
  return customer.latitude !== null && customer.longitude !== null
}
