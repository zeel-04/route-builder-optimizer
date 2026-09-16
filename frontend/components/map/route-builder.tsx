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

  return (
    <>
      <Layout
        padding={4}
        defaultHasDividers
        header={
          <LayoutHeader>
            <HStack justify="between" align="center">
              <Heading level={2}>{route ? 'Edit route' : 'New route'}</Heading>
              {onClose && (
                <IconButton variant="ghost" size="sm" label="Close" icon={<Icon icon="close" />} onClick={onClose} />
              )}
            </HStack>
          </LayoutHeader>
        }
        content={
          <LayoutContent>
            <VStack gap={6}>
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
                <ColorField value={draft.color} onChange={(color) => onChange({ ...draft, color })} />
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
            </VStack>
          </LayoutContent>
        }
        footer={
          <LayoutFooter>
            <HStack justify="between" align="center" gap={2}>
              {route ? (
                <Button variant="ghost" label="Delete" onClick={() => setDeleteOpen(true)} />
              ) : (
                <Text type="supporting">Drag stops to change the order.</Text>
              )}
              <HStack gap={2}>
                {route ? (
                  <Button variant="ghost" label="New route" href={hrefFor(null)} />
                ) : (
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
        value={value}
        onChange={(e) => onChange(e.target.value)}
        style={{
          width: 'var(--size-element-lg)',
          height: 'var(--size-element-md)',
          padding: 0,
          border: 'var(--border-width) solid var(--color-border-emphasized)',
          borderRadius: 'var(--radius-element)',
          background: 'none',
          cursor: 'pointer',
        }}
      />
    </Field>
  )
}
