import type { z } from 'zod'
import type { routeDetailSchema, routeSchema, routeStopSchema, routeWriteSchema } from './schema'

export type Route = z.infer<typeof routeSchema>
export type RouteDetail = z.infer<typeof routeDetailSchema>
export type RouteStop = z.infer<typeof routeStopSchema>
export type StopCustomer = RouteStop['customer']
export type RouteWrite = z.infer<typeof routeWriteSchema>

/** What the builder holds before it is saved. */
export type RouteDraft = {
  name: string
  color: string
  stops: StopCustomer[]
}

export type SaveRouteResult =
  | { ok: true; id: string }
  | {
      ok: false
      message: string
      fieldErrors?: Record<string, string[] | undefined>
      customerIds?: string[]
    }
