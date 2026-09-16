'use server'

import { z } from 'zod'
import { apiFetch } from '@/lib/client'
import { customerSchema, filterOptionsSchema } from './schema'
import type { CustomerFilters } from './types'

function query(params: Record<string, string>) {
  const search = new URLSearchParams(Object.entries(params).filter(([, v]) => v))
  return search.size ? `?${search}` : ''
}

export async function listCustomers(projectId: string, filters: CustomerFilters) {
  return apiFetch(`/customers/${query({ project: projectId, ...filters })}`, z.array(customerSchema))
}

export async function getFilterOptions(
  projectId: string,
  { state, county }: Pick<CustomerFilters, 'state' | 'county'>,
) {
  return apiFetch(`/customers/filter-options/${query({ project: projectId, state, county })}`, filterOptionsSchema)
}
