'use client'

import { useState, useTransition } from 'react'
import dynamic from 'next/dynamic'
import { usePathname, useRouter } from 'next/navigation'
import { Button } from '@astryxdesign/core/Button'
import { Icon } from '@astryxdesign/core/Icon'
import { Layout, LayoutContent, LayoutHeader } from '@astryxdesign/core/Layout'
import { Selector } from '@astryxdesign/core/Selector'
import { Skeleton } from '@astryxdesign/core/Skeleton'
import { HStack } from '@astryxdesign/core/Stack'
import { Text } from '@astryxdesign/core/Text'
import { TextInput } from '@astryxdesign/core/TextInput'
import type { Place, PlaceQuery } from '@/lib/features/places/types'
import { US_STATES } from '@/lib/features/places/types'

// Leaflet touches `window` at import time, so it only loads in the browser.
const ExploreLeafletMap = dynamic(() => import('./explore-map').then((m) => m.ExploreLeafletMap), {
  ssr: false,
  loading: () => <Skeleton radius="none" />,
})

// The most specific field searched decides how close to zoom in.
function zoomFor(query: PlaceQuery) {
  if (query.address) return 16
  if (query.zipcode) return 13
  if (query.city) return 12
  if (query.county) return 10
  return 7
}

type Props = { query: PlaceQuery; place: Place | null; isMissing: boolean }

export function ExploreScreen({ query, place, isMissing }: Props) {
  return (
    <Layout
      padding={3}
      // Remount on URL change so the inputs always mirror the search on the map.
      header={<SearchToolbar key={new URLSearchParams(query).toString()} query={query} isMissing={isMissing} />}
      content={
        <LayoutContent padding={0} isScrollable={false}>
          <ExploreLeafletMap place={place} zoom={zoomFor(query)} />
        </LayoutContent>
      }
    />
  )
}

function SearchToolbar({ query, isMissing }: { query: PlaceQuery; isMissing: boolean }) {
  const router = useRouter()
  const pathname = usePathname()
  const [isPending, startTransition] = useTransition()
  const [draft, setDraft] = useState(query)
  const set = (key: keyof PlaceQuery) => (value: string | null) => setDraft((d) => ({ ...d, [key]: value ?? '' }))

  function search(event: React.FormEvent) {
    event.preventDefault()
    const params = new URLSearchParams()
    for (const [key, value] of Object.entries(draft)) if (value.trim()) params.set(key, value.trim())
    startTransition(() => router.replace(params.size ? `${pathname}?${params}` : pathname))
  }

  const hasSearch = Object.values(query).some(Boolean)
  // Drops the pin and empties the inputs (the toolbar remounts); the map keeps its view.
  const clear = () => startTransition(() => router.replace(pathname))

  return (
    <LayoutHeader hasDivider>
      <form onSubmit={search} aria-label="Search for a place">
        <HStack gap={2} wrap="wrap" align="center">
          <Selector
            size="sm"
            width={170}
            label="State"
            isLabelHidden
            placeholder="State"
            options={US_STATES}
            value={draft.state || null}
            hasClear
            hasSearch
            onChange={set('state')}
          />
          <TextInput
            size="sm"
            width={150}
            label="County"
            isLabelHidden
            placeholder="County"
            value={draft.county}
            onChange={set('county')}
            hasClear
          />
          <TextInput
            size="sm"
            width={150}
            label="City"
            isLabelHidden
            placeholder="City"
            value={draft.city}
            onChange={set('city')}
            hasClear
          />
          <TextInput
            size="sm"
            width={220}
            label="Address"
            isLabelHidden
            placeholder="Street address"
            value={draft.address}
            onChange={set('address')}
            hasClear
          />
          <TextInput
            size="sm"
            width={110}
            label="ZIP code"
            isLabelHidden
            placeholder="ZIP code"
            value={draft.zipcode}
            onChange={set('zipcode')}
            hasClear
          />
          <Button type="submit" size="sm" variant="primary" label="Search" isLoading={isPending} />
          {hasSearch && <Button size="sm" variant="secondary" label="Clear" onClick={clear} isDisabled={isPending} />}
          {isMissing && !isPending && (
            <HStack gap={1} align="center" role="status">
              <Icon icon="error" size="sm" color="error" />
              <Text type="supporting">No place matches that search.</Text>
            </HStack>
          )}
        </HStack>
      </form>
    </LayoutHeader>
  )
}
