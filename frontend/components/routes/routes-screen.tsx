'use client'

import { type ReactNode, type SVGProps, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { AlertDialog } from '@astryxdesign/core/AlertDialog'
import { Button } from '@astryxdesign/core/Button'
import { EmptyState } from '@astryxdesign/core/EmptyState'
import { Heading } from '@astryxdesign/core/Heading'
import { Icon } from '@astryxdesign/core/Icon'
import { Layout, LayoutContent, LayoutHeader } from '@astryxdesign/core/Layout'
import { Link } from '@astryxdesign/core/Link'
import { MoreMenu } from '@astryxdesign/core/MoreMenu'
import { HStack, VStack } from '@astryxdesign/core/Stack'
import { pixel, Table, type TableColumn, type TablePlugin } from '@astryxdesign/core/Table'
import { Tab, TabList } from '@astryxdesign/core/TabList'
import { Text } from '@astryxdesign/core/Text'
import { TextInput } from '@astryxdesign/core/TextInput'
import { Timestamp } from '@astryxdesign/core/Timestamp'
import { useToast } from '@astryxdesign/core/Toast'
import { RouteColorDot } from '@/components/route-color-dot'
import { useUrlSearch } from '@/components/use-url-search'
import type { Project } from '@/lib/features/projects/types'
import { deleteRouteAction, getRoute } from '@/lib/features/routes/api'
import { MAX_DIRECTIONS_STOPS, directionsURL } from '@/lib/features/routes/maps'
import type { Route } from '@/lib/features/routes/types'

export type ProjectTab = 'routes' | 'customers'

type Props = {
  project: Project
  /** Already filtered by `search` (the `?q=` route-name search). */
  routes: Route[]
  search: string
  /** Whether the project has any routes at all, regardless of `search`. */
  hasRoutes: boolean
  tab: ProjectTab
  children?: ReactNode
}

/** Tabs live in `?tab=`; `children` is the Customers tab's content. */
export function RoutesScreen({ project, routes, search, hasRoutes, tab, children }: Props) {
  const router = useRouter()
  const toast = useToast()
  const [deleting, setDeleting] = useState<Route | null>(null)
  const [isDeleting, startDelete] = useTransition()
  const { text, setText, clear: clearSearch, isSearching } = useUrlSearch(search)
  const mapHref = `/projects/${project.id}/map`
  const routeHref = (route: Route) => `${mapHref}?route=${route.id}`

  // Astryx Table has no row link: the whole row opens the route, while the name
  // stays a real link for keyboard and new-tab use.
  const rowLink: TablePlugin<Route> = {
    transformBodyRow: (props, route) => ({
      ...props,
      htmlProps: {
        ...props.htmlProps,
        style: { ...props.htmlProps.style, cursor: 'pointer' },
        onClick: (event) => {
          const target = event.target as Element
          // Skip the name link, the ⋯ menu, and anything portaled out of the row
          // (menu items, hover cards) whose clicks still bubble through React.
          if (!event.currentTarget.contains(target) || target.closest('a, button, [role="menuitem"]')) return
          router.push(routeHref(route))
        },
      },
    }),
  }

  // ponytail: the list rows carry no stops, so the link is built after a fetch.
  // Safari can reject a clipboard write that late; move to a link column if that bites.
  async function copyDirections(route: Route) {
    const { stops } = await getRoute(route.id)
    await navigator.clipboard.writeText(directionsURL(stops.map((stop) => stop.customer)))
    const extra = stops.length - MAX_DIRECTIONS_STOPS
    toast({
      body: extra > 0 ? `Directions link copied, first ${MAX_DIRECTIONS_STOPS} stops only` : 'Directions link copied',
      uniqueID: 'route-directions',
    })
  }

  function remove() {
    if (!deleting) return
    startDelete(async () => {
      await deleteRouteAction(deleting.id)
      toast({ body: `Deleted “${deleting.name}”` })
      setDeleting(null)
    })
  }

  const columns: TableColumn<Route>[] = [
    {
      key: 'name',
      header: 'Route',
      renderCell: (route) => (
        <HStack gap={2} align="center">
          <RouteColorDot color={route.color} />
          <Link href={routeHref(route)}>{route.name}</Link>
        </HStack>
      ),
    },
    { key: 'stop_count', header: 'Stops', width: pixel(90), align: 'end' },
    {
      key: 'created_by',
      header: 'Created by',
      renderCell: (route) => <Text>{route.created_by?.name ?? '—'}</Text>,
    },
    {
      key: 'updated_at',
      header: 'Updated',
      width: pixel(180),
      renderCell: (route) => <Timestamp value={route.updated_at} />,
    },
    {
      key: 'id',
      header: '',
      width: pixel(290),
      align: 'end',
      renderCell: (route) => (
        <HStack gap={1} align="center" justify="end">
          <Button
            variant="ghost"
            size="sm"
            label="Directions"
            icon={<Icon icon="copy" size="sm" />}
            isDisabled={route.stop_count === 0}
            onClick={() => copyDirections(route)}
          />
          {/* A plain <a>, not the app's Next Link: the export route answers with a file download. */}
          <Button
            variant="ghost"
            size="sm"
            label="CSV"
            icon={<Icon icon={DownloadIcon} size="sm" />}
            href={`/projects/${project.id}/routes/${route.id}/export`}
            as="a"
          />
          <MoreMenu
            label={`Actions for ${route.name}`}
            size="sm"
            alignment="end"
            items={[
              { label: 'Delete', variant: 'destructive', onClick: () => setDeleting(route) },
            ]}
          />
        </HStack>
      ),
    },
  ]

  return (
    <>
      <Layout
        contentWidth={960}
        padding={4}
        header={
          <LayoutHeader paddingBlockEnd={2} style={{ paddingBlockStart: 'var(--spacing-4)' }}>
            <Heading level={1}>{project.name}</Heading>
          </LayoutHeader>
        }
        content={
          // padding={4}: Table bleeds 16px, and the scrolling content region would clip its header otherwise
          <LayoutContent padding={4}>
            <VStack gap={6}>
              {/* Tabs are links, so each tab is a shareable URL; navigation does the switching. */}
              <TabList value={tab} onChange={() => {}} hasDivider>
                <Tab value="routes" label="Routes" href={`/projects/${project.id}`} />
                <Tab value="customers" label="Customers" href={`/projects/${project.id}?tab=customers`} />
              </TabList>
              {tab === 'customers' ? (
                children
              ) : (
              <VStack gap={4}>
                {hasRoutes && (
                  <HStack justify="between" align="center" gap={2} wrap="wrap">
                    <TextInput
                      width={280}
                      label="Search routes"
                      isLabelHidden
                      placeholder="Search routes"
                      startIcon="search"
                      value={text}
                      onChange={setText}
                      hasClear
                      isLoading={isSearching}
                    />
                    <Button variant="primary" label="New route" href={mapHref} />
                  </HStack>
                )}
                {!hasRoutes ? (
                  <EmptyState
                    title="No routes yet"
                    description="Build the first one by picking customer pins on the map."
                    actions={<Button variant="primary" label="Go to map" href={mapHref} />}
                  />
                ) : routes.length === 0 ? (
                  <EmptyState
                    icon={<Icon icon="search" size="lg" color="secondary" />}
                    title="No routes match"
                    description={`Nothing matches “${search}”. Try a different route name.`}
                    actions={<Button label="Clear search" variant="secondary" onClick={clearSearch} />}
                  />
                ) : (
                  <Table data={routes} columns={columns} idKey="id" hasHover plugins={{ rowLink }} />
                )}
              </VStack>
              )}
            </VStack>
          </LayoutContent>
        }
      />

      <AlertDialog
        isOpen={deleting !== null}
        onOpenChange={(open) => !open && setDeleting(null)}
        title={`Delete route “${deleting?.name ?? ''}”?`}
        description="Its stops become free to add to another route. This can't be undone."
        actionLabel="Delete route"
        isActionLoading={isDeleting}
        onAction={remove}
      />
    </>
  )
}

function DownloadIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M8 2v8M4.5 6.5 8 10l3.5-3.5M3 13h10" />
    </svg>
  )
}
