'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { ApiError, apiFetch, validationErrors } from '@/lib/client'
import {
  customerCreateSchema,
  customerPageSchema,
  customerSchema,
  customerUploadSchema,
  filterOptionsSchema,
  uploadResultSchema,
} from './schema'
import { type AddCustomerState, CUSTOMER_PAGE_SIZE, type CustomerFilters, type UploadState } from './types'

function query(params: Record<string, string>) {
  const search = new URLSearchParams(Object.entries(params).filter(([, v]) => v))
  return search.size ? `?${search}` : ''
}

export async function listCustomers(projectId: string, filters: CustomerFilters) {
  return apiFetch(`/customers/${query({ project: projectId, ...filters })}`, z.array(customerSchema))
}

/** One page of a project's customers, optionally searched. The backend 404s a page past the end. */
export async function listProjectCustomers(projectId: string, page: number, search = '') {
  return apiFetch(
    `/projects/${projectId}/customers/${query({ page: String(page), page_size: String(CUSTOMER_PAGE_SIZE), search })}`,
    customerPageSchema,
  )
}

export async function getFilterOptions(
  projectId: string,
  { state, county }: Pick<CustomerFilters, 'state' | 'county'>,
) {
  return apiFetch(`/customers/filter-options/${query({ project: projectId, state, county })}`, filterOptionsSchema)
}

const uploadErrorSchema = z.object({
  missing_columns: z.array(z.string()).optional(),
  errors: z.array(z.object({ row: z.number(), messages: z.array(z.string()) })).optional(),
})

/** Turns the upload 400's `extra` into one readable line per problem. */
function uploadErrorDetails(extra: Record<string, unknown>): string[] {
  const parsed = uploadErrorSchema.safeParse(extra)
  if (!parsed.success) return []
  const { missing_columns = [], errors = [] } = parsed.data
  return [
    ...(missing_columns.length ? [`Missing columns: ${missing_columns.join(', ')}`] : []),
    ...errors.map((e) => `Row ${e.row}: ${e.messages.join(' ')}`),
  ]
}

export async function addCustomerAction(projectId: string, formData: FormData): Promise<AddCustomerState> {
  return saveCustomer(`/projects/${projectId}/customers/`, 'POST', formData)
}

export async function updateCustomerAction(
  projectId: string,
  customerId: string,
  formData: FormData,
): Promise<AddCustomerState> {
  return saveCustomer(`/projects/${projectId}/customers/${customerId}/`, 'PATCH', formData)
}

export async function deleteCustomerAction(projectId: string, customerId: string) {
  await apiFetch(`/projects/${projectId}/customers/${customerId}/`, z.void(), { method: 'DELETE' })
  revalidatePath('/', 'layout')
}

/** Shared by add and edit: same schema, same error mapping. Not exported, so not an endpoint. */
async function saveCustomer(path: string, method: 'POST' | 'PATCH', formData: FormData): Promise<AddCustomerState> {
  const parsed = customerCreateSchema.safeParse(Object.fromEntries(formData)) // actions are public endpoints
  if (!parsed.success) return { ok: false, errors: z.flattenError(parsed.error).fieldErrors }

  try {
    await apiFetch(path, customerSchema, { method, body: JSON.stringify(parsed.data) })
  } catch (err) {
    if (err instanceof ApiError && err.status === 400) {
      return { ok: false, ...validationErrors(err, Object.keys(customerCreateSchema.shape)) }
    }
    throw err
  }
  revalidatePath('/', 'layout')
  return { ok: true }
}

export async function uploadCustomersAction(projectId: string, formData: FormData): Promise<UploadState> {
  const parsed = customerUploadSchema.safeParse({ file: formData.get('file') })
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0].message, details: [] }

  const body = new FormData()
  body.set('file', parsed.data.file)
  try {
    const result = await apiFetch(`/projects/${projectId}/customers/upload/`, uploadResultSchema, {
      method: 'POST',
      body,
    })
    revalidatePath('/', 'layout')
    return { ok: true, ...result }
  } catch (err) {
    if (err instanceof ApiError && err.status === 400) {
      return { ok: false, message: err.message, details: uploadErrorDetails(err.extra) }
    }
    throw err
  }
}
