import { ExploreScreen } from '@/components/map/explore-screen'
import { searchPlace } from '@/lib/features/places/api'

const first = (value: string | string[] | undefined) => ((Array.isArray(value) ? value[0] : value) ?? '').trim()

export default async function ExploreMapPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const params = await searchParams
  const query = {
    state: first(params.state),
    county: first(params.county),
    city: first(params.city),
    address: first(params.address),
  }
  const hasQuery = Object.values(query).some(Boolean)
  const place = hasQuery ? await searchPlace(query) : null

  return <ExploreScreen query={query} place={place} isMissing={hasQuery && place === null} />
}
