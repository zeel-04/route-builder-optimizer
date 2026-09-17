import { redirect } from 'next/navigation'
import { CustomersSection } from '@/components/customers/customers-section'
import { RoutesScreen } from '@/components/routes/routes-screen'
import { ApiError } from '@/lib/client'
import { listProjectCustomers } from '@/lib/features/customers/api'
import { CUSTOMER_PAGE_SIZE } from '@/lib/features/customers/types'
import { getProject } from '@/lib/features/projects/api'
import { listRoutes } from '@/lib/features/routes/api'
import { or404 } from './or-404'

type Props = {
  params: Promise<{ projectId: string }>
  searchParams: Promise<{ tab?: string | string[]; page?: string | string[]; q?: string | string[] }>
}

/** Reads one customers page; a page past the end redirects to the last one instead of 404ing. */
async function readCustomerPage(projectId: string, page: number, search: string) {
  try {
    return await listProjectCustomers(projectId, page, search)
  } catch (err) {
    if (!(err instanceof ApiError && err.status === 404) || page === 1) throw err
  }
  // Page 1 never 404s for a real project, so this also surfaces a missing project as a 404.
  const { count } = await listProjectCustomers(projectId, 1, search)
  const last = Math.ceil(count / CUSTOMER_PAGE_SIZE)
  const params = new URLSearchParams({ tab: 'customers' })
  if (search) params.set('q', search)
  if (last > 1) params.set('page', String(last))
  redirect(`/projects/${projectId}?${params}`)
}

export default async function ProjectRoutesPage({ params, searchParams }: Props) {
  const [{ projectId }, query] = await Promise.all([params, searchParams])
  const tab = query.tab === 'customers' ? 'customers' : 'routes'
  const page = Math.max(1, Math.floor(Number(query.page)) || 1)
  const search = typeof query.q === 'string' ? query.q : ''

  const [project, allRoutes, customers] = await or404(
    Promise.all([
      getProject(projectId),
      listRoutes(projectId),
      tab === 'customers' ? readCustomerPage(projectId, page, search) : null,
    ]),
  )
  // ponytail: routes are filtered here since the list isn't paginated; move to the API if it ever is.
  const routeSearch = tab === 'routes' ? search.trim().toLowerCase() : ''
  const routes = allRoutes.filter((r) => r.name.toLowerCase().includes(routeSearch))

  // A search with no matches still shows the search bar, as long as the project has customers.
  const hasCustomers =
    !!customers && (customers.count > 0 || (!!search && (await listProjectCustomers(projectId, 1)).count > 0))

  return (
    <RoutesScreen
      project={project}
      routes={routes}
      search={tab === 'routes' ? search : ''}
      hasRoutes={allRoutes.length > 0}
      tab={tab}
    >
      {customers && (
        <CustomersSection
          projectId={project.id}
          customers={customers.results}
          page={page}
          total={customers.count}
          search={search}
          hasCustomers={hasCustomers}
        />
      )}
    </RoutesScreen>
  )
}
