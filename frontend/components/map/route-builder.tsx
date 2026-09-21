'use client'

import { useId, useState, useTransition, type SVGProps } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { AlertDialog } from '@astryxdesign/core/AlertDialog'
import { Banner } from '@astryxdesign/core/Banner'
import { Button } from '@astryxdesign/core/Button'
import { EmptyState } from '@astryxdesign/core/EmptyState'
import { Field } from '@astryxdesign/core/Field'
import { FormLayout } from '@astryxdesign/core/FormLayout'
import { Heading } from '@astryxdesign/core/Heading'
import { Icon } from '@astryxdesign/core/Icon'
import { IconButton } from '@astryxdesign/core/IconButton'
import { Layout, LayoutContent, LayoutFooter, LayoutHeader } from '@astryxdesign/core/Layout'
import { List, ListItem } from '@astryxdesign/core/List'
import { HStack, VStack } from '@astryxdesign/core/Stack'
import { Text } from '@astryxdesign/core/Text'
import { TextInput } from '@astryxdesign/core/TextInput'
import { useToast } from '@astryxdesign/core/Toast'
import { deleteRouteAction, saveRouteAction } from '@/lib/features/routes/api'
import { downloadCSV, stopsToCSV } from '@/lib/features/routes/csv'
import { MAX_DIRECTIONS_STOPS, directionsURL } from '@/lib/features/routes/maps'
import { optimizeStops, routeKm } from '@/lib/features/routes/optimize'
import type { RouteDetail, RouteDraft, SaveRouteResult } from '@/lib/features/routes/types'

type Props = {
  projectId: string
  route: RouteDetail | null
  draft: RouteDraft
  onChange: (draft: RouteDraft) => void
  onClose?: () => void
}

export function RouteBuilder({ projectId, route, draft, onChange, onClose }: Props) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const toast = useToast()
  const [isSaving, startSave] = useTransition()
  const [isDeleting, startDelete] = useTransition()
  const [error, setError] = useState<Extract<SaveRouteResult, { ok: false }> | null>(null)
  const [isDeleteOpen, setDeleteOpen] = useState(false)

  const isDirty =
    !route ||
    draft.name !== route.name ||
    draft.color !== route.color ||
    draft.stops.map((s) => s.id).join() !== route.stops.map((s) => s.customer.id).join()

  // Keep the map filters, change only which route is open.
  function hrefFor(routeId: string | null) {
    const params = new URLSearchParams(searchParams)
    if (routeId) params.set('route', routeId)
    else params.delete('route')
    return params.size ? `${pathname}?${params}` : pathname
  }

  function save() {
    setError(null)
    startSave(async () => {
      const result = await saveRouteAction(route?.id ?? null, {
        project: projectId,
        name: draft.name,
        color: draft.color,
        customer_ids: draft.stops.map((s) => s.id),
      })
      if (!result.ok) {
        setError(result)
        return
      }
      toast({ body: route ? 'Route updated' : 'Route saved' })
      if (!route) router.replace(hrefFor(result.id))
    })
  }

  function remove() {
    if (!route) return
    startDelete(async () => {
      await deleteRouteAction(route.id)
      toast({ body: 'Route deleted' })
      router.replace(hrefFor(null))
    })
  }

  const nameError = error?.fieldErrors?.name?.[0]
  const failedIds = new Set(error?.customerIds ?? [])

  // Reordering: drag a row, or focus its handle and press the arrow keys.
  // ponytail: native HTML5 drag & drop; swap in dnd-kit if touch drag is needed.
  const [dragIndex, setDragIndex] = useState<number | null>(null)
  function move(from: number, to: number) {
    if (from === to || to < 0 || to >= draft.stops.length) return
    const stops = [...draft.stops]
    const [moved] = stops.splice(from, 1)
    stops.splice(to, 0, moved)
    onChange({ ...draft, stops })
  }

  const canOptimize = draft.stops.filter((s) => s.latitude !== null && s.longitude !== null).length >= 3
  function optimize() {
    const before = draft
    const stops = optimizeStops(draft.stops)
    const miles = Math.round(routeKm(stops) * 0.621)
    onChange({ ...draft, stops })
    toast({
      body: `Route optimized: ${stops.length} stops, about ${miles} mi`,
      uniqueID: 'route-optimize',
      endContent: <Button variant="ghost" size="sm" label="Undo" onClick={() => onChange(before)} />,
    })
  }

  async function copyDirections() {
    await navigator.clipboard.writeText(directionsURL(draft.stops))
    const extra = draft.stops.length - MAX_DIRECTIONS_STOPS
    toast({
      body: extra > 0 ? `Directions link copied, first ${MAX_DIRECTIONS_STOPS} stops only` : 'Directions link copied',
      uniqueID: 'route-directions',
    })
  }

  function flip() {
    onChange({ ...draft, stops: [...draft.stops].reverse() })
  }

  return (
    <>
      <Layout
        padding={4}
        defaultHasDividers
        header={
          <LayoutHeader>
            <HStack justify="between" align="center">
              <Heading level={2}>{route ? 'Edit route' : 'New route'}</Heading>
              <HStack gap={2} align="center">
                {route && <Button variant="ghost" size="sm" label="New route" href={hrefFor(null)} />}
                {onClose && (
                  <IconButton variant="ghost" size="sm" label="Close" icon={<Icon icon="close" />} onClick={onClose} />
                )}
              </HStack>
            </HStack>
          </LayoutHeader>
        }
        content={
          <LayoutContent>
            {/* Full height so the tools row can sit at the bottom even with few stops. */}
            <VStack gap={6} style={{ minHeight: '100%' }}>
              {error && !nameError && <Banner status="error" title={error.message} />}

              <FormLayout>
                <TextInput
                  label="Name"
                  value={draft.name}
                  onChange={(name) => onChange({ ...draft, name })}
                  isRequired
                  placeholder="Tuesday loop"
                  status={nameError ? { type: 'error', message: nameError } : undefined}
                />
                {/* Exports sit beside the color swatch, which leaves the rest of its row empty. */}
                <HStack gap={2} align="end" justify="between">
                  <ColorField value={draft.color} onChange={(color) => onChange({ ...draft, color })} />
                  <HStack gap={2} align="center">
                    <Button
                      variant="ghost"
                      size="sm"
                      label="Directions"
                      icon={<Icon icon="copy" size="sm" />}
                      isDisabled={draft.stops.length === 0}
                      onClick={copyDirections}
                    />
                    <Button
                      variant="ghost"
                      size="sm"
                      label="CSV"
                      icon={<Icon icon={DownloadIcon} size="sm" />}
                      isDisabled={draft.stops.length === 0}
                      onClick={() => downloadCSV(draft.name || 'route', stopsToCSV(draft.stops))}
                    />
                  </HStack>
                </HStack>
              </FormLayout>

              {draft.stops.length === 0 ? (
                <EmptyState
                  isCompact
                  title="No stops yet"
                  description="Click a pin on the map to add it as a stop."
                />
              ) : (
                <List
                  header={<Text weight="semibold">{draft.stops.length} {draft.stops.length === 1 ? 'stop' : 'stops'}</Text>}
                  density="compact"
                  hasDividers
                >
                  {draft.stops.map((stop, i) => (
                    <ListItem
                      key={stop.id}
                      label={stop.name}
                      description={`${stop.address}, ${stop.city}`}
                      draggable
                      onDragStart={() => setDragIndex(i)}
                      onDragOver={(e) => e.preventDefault()}
                      onDrop={() => {
                        if (dragIndex !== null) move(dragIndex, i)
                        setDragIndex(null)
                      }}
                      onDragEnd={() => setDragIndex(null)}
                      style={{ opacity: dragIndex === i ? 0.4 : 1, cursor: 'grab' }}
                      startContent={
                        <HStack gap={1} align="center">
                          <Text color="secondary" hasTabularNumbers>
                            {i + 1}.
                          </Text>
                          <IconButton
                            variant="ghost"
                            size="sm"
                            label={`Move ${stop.name}: arrow keys change its position`}
                            icon={<Icon icon={GripIcon} size="sm" />}
                            onKeyDown={(e) => {
                              if (e.key !== 'ArrowUp' && e.key !== 'ArrowDown') return
                              e.preventDefault()
                              move(i, e.key === 'ArrowUp' ? i - 1 : i + 1)
                            }}
                          />
                        </HStack>
                      }
                      endContent={
                        <HStack gap={1} align="center">
                          {failedIds.has(stop.id) && <Icon icon="error" size="sm" color="error" label="Can't be added" />}
                          <IconButton
                            variant="ghost"
                            size="sm"
                            label={`Remove ${stop.name}`}
                            icon={<Icon icon="close" size="sm" />}
                            onClick={() => onChange({ ...draft, stops: draft.stops.filter((s) => s.id !== stop.id) })}
                          />
                        </HStack>
                      }
                    />
                  ))}
                </List>
              )}
              {/* Stays reachable while a long stop list scrolls under it. Sticky insets stop at the
                  scroller's content edge, so reach down over its bottom padding or rows show below. */}
              <div
                style={{
                  marginTop: 'auto',
                  position: 'sticky',
                  bottom: 'calc(-1 * var(--spacing-4))',
                  marginBottom: 'calc(-1 * var(--spacing-4))',
                  zIndex: 1,
                  background: 'var(--color-background-surface)',
                  paddingTop: 'var(--spacing-1)',
                  paddingBottom: 'var(--spacing-4)',
                }}
              >
                <HStack gap={2} justify="evenly">
                  <Button
                    variant="ghost"
                    label="Optimize"
                    icon={<Icon icon={ZapIcon} size="sm" />}
                    isDisabled={!canOptimize}
                    onClick={optimize}
                  />
                  <Button
                    variant="ghost"
                    label="Flip"
                    icon={<Icon icon={FlipIcon} size="sm" />}
                    isDisabled={draft.stops.length < 2}
                    onClick={flip}
                  />
                </HStack>
              </div>
            </VStack>
          </LayoutContent>
        }
        footer={
          <LayoutFooter>
            <HStack justify="end" align="center" gap={2}>
              <HStack gap={2}>
                {!route && (
                  <Button
                    variant="ghost"
                    label="Clear"
                    isDisabled={draft.stops.length === 0 && !draft.name}
                    onClick={() => onChange({ ...draft, name: '', stops: [] })}
                  />
                )}
                <Button
                  variant="primary"
                  label={isSaving ? 'Saving…' : route ? 'Save changes' : 'Save route'}
                  isLoading={isSaving}
                  isDisabled={!isDirty}
                  onClick={save}
                />
              </HStack>
            </HStack>
          </LayoutFooter>
        }
      />

      {route && (
        <AlertDialog
          isOpen={isDeleteOpen}
          onOpenChange={setDeleteOpen}
          title={`Delete route “${route.name}”?`}
          description="Its stops become free to add to another route. This can't be undone."
          actionLabel="Delete route"
          isActionLoading={isDeleting}
          onAction={remove}
        />
      )}
    </>
  )
}

// Lucide icons (ISC licence), inlined rather than adding lucide-react for three glyphs.
function strokeProps(props: SVGProps<SVGSVGElement>) {
  return {
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 2,
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
    ...props,
  } as SVGProps<SVGSVGElement>
}

/** Lucide "zap". */
function ZapIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...strokeProps(props)}>
      <path d="M4 14a1 1 0 0 1-.78-1.63l9.9-10.2a.5.5 0 0 1 .86.46l-1.92 6.02A1 1 0 0 0 13 10h7a1 1 0 0 1 .78 1.63l-9.9 10.2a.5.5 0 0 1-.86-.46l1.92-6.02A1 1 0 0 0 11 14z" />
    </svg>
  )
}

/** Lucide "arrow-up-down". */
function FlipIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...strokeProps(props)}>
      <path d="m21 16-4 4-4-4" />
      <path d="M17 20V4" />
      <path d="m3 8 4-4 4 4" />
      <path d="M7 4v16" />
    </svg>
  )
}

/** Lucide "download". */
function DownloadIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...strokeProps(props)}>
      <path d="M12 15V3" />
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <path d="m7 10 5 5 5-5" />
    </svg>
  )
}

function GripIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 16 16" fill="currentColor" {...props}>
      <circle cx="6" cy="4" r="1.5" />
      <circle cx="10" cy="4" r="1.5" />
      <circle cx="6" cy="8" r="1.5" />
      <circle cx="10" cy="8" r="1.5" />
      <circle cx="6" cy="12" r="1.5" />
      <circle cx="10" cy="12" r="1.5" />
    </svg>
  )
}

/** Native color input inside the Field shell; a picker library would be overkill. */
function ColorField({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  const id = useId()
  return (
    <Field label="Color" inputID={id}>
      <input
        id={id}
        type="color"
        className="color-swatch"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </Field>
  )
}
