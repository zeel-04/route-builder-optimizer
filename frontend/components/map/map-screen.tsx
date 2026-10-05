'use client'

import { useMemo, useState } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { Button } from '@astryxdesign/core/Button'
import { Center } from '@astryxdesign/core/Center'
import { Dialog } from '@astryxdesign/core/Dialog'
import { EmptyState } from '@astryxdesign/core/EmptyState'
import { useMediaQuery } from '@astryxdesign/core/hooks'
import { Layout, LayoutContent, LayoutFooter, LayoutPanel } from '@astryxdesign/core/Layout'
import { HStack, VStack } from '@astryxdesign/core/Stack'
import { Text } from '@astryxdesign/core/Text'
import { RouteColorDot } from '@/components/route-color-dot'
import { AssignmentFilters } from '@/components/customers/assignment-filters'
import { draftAssignment, projectDraftSummary, summarizeDraft } from '@/lib/features/customers/assignment'
import type { AssignmentFilter, AssignmentSummary, Customer, CustomerFilters, FilterOptions } from '@/lib/features/customers/types'
import { hasPin, LocationAccuracy } from '@/lib/features/customers/types'
import type { Project } from '@/lib/features/projects/types'
import type { RouteDetail, RouteDraft } from '@/lib/features/routes/types'
import { CustomerMap } from './customer-map'
import { FilterToolbar } from './filter-toolbar'
import { RouteBuilder } from './route-builder'

// Distinct colors the backend accepts (6-digit hex). New routes cycle through them.
const PALETTE = ['#0064E0', '#0D8626', '#E9690B', '#C2185B', '#5B08D8', '#009688', '#D31130', '#C58600']

type Props = {
  project: Project
  customers: Customer[]
  options: FilterOptions
  filters: CustomerFilters
  route: RouteDetail | null
  summary: AssignmentSummary
  assignment: AssignmentFilter
}

function draftFor(route: RouteDetail | null, customers: Customer[]): RouteDraft {
  if (route) return { name: route.name, color: route.color, stops: route.stops.map((s) => s.customer) }
  const routeCount = new Set(customers.map((c) => c.route?.id).filter(Boolean)).size
  return { name: '', color: PALETTE[routeCount % PALETTE.length], stops: [] }
}

export function MapScreen({ project, customers, options, filters, route, summary, assignment }: Props) {
  const pathname = usePathname()
  const router = useRouter()
  const searchParams = useSearchParams()
  const isNarrow = useMediaQuery('(max-width: 1024px)')
  const [isBuilderOpen, setBuilderOpen] = useState(false)
  const [draft, setDraft] = useState<RouteDraft>(() => draftFor(route, customers))

  // The route in the URL changed: either our own save landed on ?route=<id> (keep the
  // map where it is) or a different route was opened (refit to its stops).
  const [synced, setSynced] = useState({ routeId: route?.id ?? null, focusNonce: 0 })
  if ((route?.id ?? null) !== synced.routeId) {
    const ownSave =
      route !== null &&
      route.stops.map((s) => s.customer.id).join() === draft.stops.map((s) => s.id).join()
    setSynced({ routeId: route?.id ?? null, focusNonce: ownSave ? synced.focusNonce : synced.focusNonce + 1 })
    setDraft(draftFor(route, customers))
  }

  const stopIds = useMemo(() => new Set(draft.stops.map((s) => s.id)), [draft.stops])
  const matchingSummary = summarizeDraft(customers, stopIds, route?.id ?? null)
  const projectSummary = projectDraftSummary(summary, route, draft)
  const otherCount = projectSummary.assigned - draft.stops.length
  const visibleCustomers = Array.from(new Map([
    ...customers.filter((c) => {
      const status = draftAssignment(c, stopIds, route?.id ?? null)
      return assignment === 'all' || (assignment === 'assigned' ? status !== 'unassigned' : status === 'unassigned')
    }),
    ...draft.stops.map((c) => ({ ...c, route: null })), // Keep the current route visible as context for every filter.
  ].map((c) => [c.id, c])).values())
  const isDirty = route
    ? draft.name !== route.name || draft.color !== route.color || draft.stops.map((s) => s.id).join() !== route.stops.map((s) => s.customer.id).join()
    : draft.stops.length > 0 || !!draft.name
  const unpinned = customers.filter((c) => !hasPin(c)).length
  const pending = customers.filter((c) => c.is_geocode_pending).length
  const approximate = customers.filter((c) => c.location_accuracy === LocationAccuracy.ZIP).length
  const hasFilters = Object.values(filters).some(Boolean)

  function filterAssignment(next: AssignmentFilter) {
    const params = new URLSearchParams(searchParams)
    if (next === 'all') params.delete('assignment')
    else params.set('assignment', next)
    router.push(`${pathname}?${params}`, { scroll: false })
  }

  function addStop(customer: Customer) {
    if (stopIds.has(customer.id)) return
    setDraft((d) => ({ ...d, stops: [...d.stops, customer] }))
  }

  const builder = (
    <RouteBuilder
      projectId={project.id}
      route={route}
      draft={draft}
      onChange={setDraft}
      onClose={isNarrow ? () => setBuilderOpen(false) : undefined}
    />
  )

  return (
    <>
      <Layout
        padding={3}
        header={
          <FilterToolbar
            projectName={project.name}
            filters={filters}
            options={options}
            total={customers.length}
            pending={pending}
            notFound={unpinned - pending}
            approximate={approximate}
          >
            <VStack gap={1}>
              <HStack gap={3} align="center" wrap="wrap">
                <AssignmentFilters value={assignment} summary={matchingSummary} onChange={filterAssignment} />
                <Text type="supporting" aria-live="polite">
                  {projectSummary.total} in project · {draft.stops.length} on this route · {otherCount} on other routes · {projectSummary.unassigned} unassigned
                  {isDirty ? ' · Unsaved changes' : ''}
                </Text>
              </HStack>
              {hasFilters && <Text type="supporting">{matchingSummary.total} {matchingSummary.total === 1 ? 'customer matches' : 'customers match'} these filters · {matchingSummary.unassigned} unassigned {matchingSummary.unassigned === 1 ? 'match' : 'matches'} · {projectSummary.unassigned} unassigned in project</Text>}
              <HStack gap={3} wrap="wrap" align="center">
                <HStack gap={1} align="center"><RouteColorDot color={draft.color} /><Text type="supporting">Current route: numbered pins</Text></HStack>
                <Text type="supporting">Other routes: smaller numbered pins</Text>
                <Text type="supporting">Unassigned: plain pins</Text>
                {matchingSummary.unassigned_without_location > 0 && <Text type="supporting">{matchingSummary.unassigned_without_location} unassigned without a map location{hasFilters ? ' in these filters' : ''}</Text>}
              </HStack>
            </VStack>
          </FilterToolbar>
        }
        content={
          <LayoutContent padding={0} isScrollable={false}>
            {visibleCustomers.length === 0 ? (
              <Center height="100%">
                <EmptyState
                  title={assignment === 'unassigned' && matchingSummary.total > 0 ? 'All matching customers are assigned' : 'No customers match'}
                  description="Try another assignment filter, state, county, city or ZIP code, or clear the search."
                  actions={
                    (hasFilters || assignment !== 'all') && <Button label="Clear filters" href={route ? `${pathname}?route=${route.id}` : pathname} />
                  }
                />
              </Center>
            ) : (
              <CustomerMap
                customers={visibleCustomers}
                draft={draft}
                editingRouteId={route?.id ?? null}
                onAddStop={addStop}
                isSearching={!!(filters.search || filters.zipcode)}
                filtersKey={JSON.stringify({ ...filters, assignment })}
                focus={route ? route.stops.map((s) => s.customer).filter(hasPin) : []}
                focusNonce={synced.focusNonce}
              />
            )}
          </LayoutContent>
        }
        end={
          isNarrow ? undefined : (
            <LayoutPanel width={380} padding={0} hasDivider isScrollable={false} label="Route">
              {builder}
            </LayoutPanel>
          )
        }
        footer={
          isNarrow ? (
            <LayoutFooter hasDivider>
              <Button
                variant="primary"
                width="100%"
                label={`Route · ${draft.stops.length} ${draft.stops.length === 1 ? 'stop' : 'stops'}`}
                onClick={() => setBuilderOpen(true)}
              />
            </LayoutFooter>
          ) : undefined
        }
      />

      {isNarrow && (
        <Dialog
          isOpen={isBuilderOpen}
          onOpenChange={setBuilderOpen}
          variant="fullscreen"
          purpose="form"
          padding={0}
          aria-label={route ? 'Edit route' : 'New route'}
        >
          {builder}
        </Dialog>
      )}
    </>
  )
}
