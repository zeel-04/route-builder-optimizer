import { hasPin, type AssignmentSummary, type Customer } from './types'
import type { RouteDetail, RouteDraft } from '@/lib/features/routes/types'

/** The current draft overrides its saved assignments, including removed stops. */
export function draftAssignment(customer: Customer, stopIds: Set<string>, routeId: string | null) {
  if (stopIds.has(customer.id)) return 'current'
  if (customer.route && customer.route.id !== routeId) return 'other'
  return 'unassigned'
}

export function summarizeDraft(customers: Customer[], stopIds: Set<string>, routeId: string | null): AssignmentSummary {
  const unassigned = customers.filter((c) => draftAssignment(c, stopIds, routeId) === 'unassigned')
  return {
    total: customers.length,
    assigned: customers.length - unassigned.length,
    unassigned: unassigned.length,
    unassigned_without_location: unassigned.filter((c) => !hasPin(c)).length,
  }
}

export function projectDraftSummary(saved: AssignmentSummary, route: RouteDetail | null, draft: RouteDraft): AssignmentSummary {
  const savedStops = route?.stops.map((s) => s.customer) ?? []
  const assigned = saved.assigned - savedStops.length + draft.stops.length
  return {
    total: saved.total,
    assigned,
    unassigned: saved.total - assigned,
    unassigned_without_location: saved.unassigned_without_location
      + savedStops.filter((c) => !hasPin(c)).length - draft.stops.filter((c) => !hasPin(c)).length,
  }
}
