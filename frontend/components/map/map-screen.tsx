'use client'

import { useMemo, useState } from 'react'
import { usePathname } from 'next/navigation'
import { Button } from '@astryxdesign/core/Button'
import { Center } from '@astryxdesign/core/Center'
import { Dialog } from '@astryxdesign/core/Dialog'
import { EmptyState } from '@astryxdesign/core/EmptyState'
import { useMediaQuery } from '@astryxdesign/core/hooks'
import { Layout, LayoutContent, LayoutFooter, LayoutPanel } from '@astryxdesign/core/Layout'
import type { Customer, CustomerFilters, FilterOptions } from '@/lib/features/customers/types'
import { hasPin } from '@/lib/features/customers/types'
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
}

function draftFor(route: RouteDetail | null, customers: Customer[]): RouteDraft {
  if (route) return { name: route.name, color: route.color, stops: route.stops.map((s) => s.customer) }
  const routeCount = new Set(customers.map((c) => c.route?.id).filter(Boolean)).size
  return { name: '', color: PALETTE[routeCount % PALETTE.length], stops: [] }
}

export function MapScreen({ project, customers, options, filters, route }: Props) {
  const pathname = usePathname()
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
  const unpinned = customers.filter((c) => !hasPin(c)).length
  const pending = customers.filter((c) => c.is_geocode_pending).length
  const hasFilters = Object.values(filters).some(Boolean)

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
          />
        }
        content={
          <LayoutContent padding={0} isScrollable={false}>
            {customers.length === 0 ? (
              <Center height="100%">
                <EmptyState
                  title="No customers match"
                  description="Try another state, county or city, or clear the search."
                  actions={
                    hasFilters && <Button label="Clear filters" href={route ? `${pathname}?route=${route.id}` : pathname} />
                  }
                />
              </Center>
            ) : (
              <CustomerMap
                customers={customers}
                draft={draft}
                editingRouteId={route?.id ?? null}
                onAddStop={addStop}
                filtersKey={JSON.stringify(filters)}
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

      <Dialog
        isOpen={isNarrow && isBuilderOpen}
        onOpenChange={setBuilderOpen}
        variant="fullscreen"
        purpose="form"
        padding={0}
        aria-label={route ? 'Edit route' : 'New route'}
      >
        {builder}
      </Dialog>
    </>
  )
}
