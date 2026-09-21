import { notFound } from 'next/navigation'
import { MapScreen } from '@/components/map/map-screen'
import { getFilterOptions, listCustomers } from '@/lib/features/customers/api'
import { getProject } from '@/lib/features/projects/api'
import { getRoute } from '@/lib/features/routes/api'
import { or404 } from '../or-404'

const first = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value) ?? ''

type Props = {
  params: Promise<{ projectId: string }>
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

export default async function MapPage({ params, searchParams }: Props) {
  const [{ projectId }, query] = await Promise.all([params, searchParams])
  const filters = {
    state: first(query.state),
    county: first(query.county),
    city: first(query.city),
    zipcode: first(query.zipcode),
    search: first(query.search),
  }
  const routeId = first(query.route)

  const [project, customers, options, route] = await or404(
    Promise.all([
      getProject(projectId),
      listCustomers(projectId, filters),
      getFilterOptions(projectId, filters),
      routeId ? getRoute(routeId) : null,
    ]),
  )
  // A route opened under another project's URL is as missing as one that doesn't exist.
  if (route && route.project_id !== project.id) notFound()

  return <MapScreen project={project} customers={customers} options={options} filters={filters} route={route} />
}
