'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { AlertDialog } from '@astryxdesign/core/AlertDialog'
import { Button } from '@astryxdesign/core/Button'
import { EmptyState } from '@astryxdesign/core/EmptyState'
import { Heading } from '@astryxdesign/core/Heading'
import { Layout, LayoutContent, LayoutHeader } from '@astryxdesign/core/Layout'
import { Link } from '@astryxdesign/core/Link'
import { MoreMenu } from '@astryxdesign/core/MoreMenu'
import { HStack } from '@astryxdesign/core/Stack'
import { pixel, Table, type TableColumn, type TablePlugin } from '@astryxdesign/core/Table'
import { Text } from '@astryxdesign/core/Text'
import { Timestamp } from '@astryxdesign/core/Timestamp'
import { useToast } from '@astryxdesign/core/Toast'
import { RouteColorDot } from '@/components/route-color-dot'
import type { Project } from '@/lib/features/projects/types'
import { deleteRouteAction } from '@/lib/features/routes/api'
import type { Route } from '@/lib/features/routes/types'

export function RoutesScreen({ project, routes }: { project: Project; routes: Route[] }) {
  const router = useRouter()
  const toast = useToast()
  const [deleting, setDeleting] = useState<Route | null>(null)
  const [isDeleting, startDelete] = useTransition()
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
      width: pixel(56),
      align: 'end',
      renderCell: (route) => (
        <MoreMenu
          label={`Actions for ${route.name}`}
          size="sm"
          alignment="end"
          items={[
            { label: 'Delete', variant: 'destructive', onClick: () => setDeleting(route) },
          ]}
        />
      ),
    },
  ]

  return (
    <>
      <Layout
        contentWidth={960}
        padding={4}
        header={
          <LayoutHeader>
            <HStack justify="between" align="center">
              <Heading level={1}>{project.name}</Heading>
              <Button variant="primary" label="New route" href={mapHref} />
            </HStack>
          </LayoutHeader>
        }
        content={
          // padding={4}: Table bleeds 16px, and the scrolling content region would clip its header otherwise
          <LayoutContent padding={4}>
            {routes.length === 0 ? (
              <EmptyState
                title="No routes yet"
                description="Build the first one by picking customer pins on the map."
                actions={<Button variant="primary" label="Go to map" href={mapHref} />}
              />
            ) : (
              <Table data={routes} columns={columns} idKey="id" hasHover plugins={{ rowLink }} />
            )}
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
