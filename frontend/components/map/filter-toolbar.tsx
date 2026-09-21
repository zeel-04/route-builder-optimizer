'use client'

import { useCallback, useEffect, useRef, useState, useTransition } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { Badge } from '@astryxdesign/core/Badge'
import { LayoutHeader } from '@astryxdesign/core/Layout'
import { Selector } from '@astryxdesign/core/Selector'
import { Spinner } from '@astryxdesign/core/Spinner'
import { HStack } from '@astryxdesign/core/Stack'
import { Text } from '@astryxdesign/core/Text'
import { TextInput } from '@astryxdesign/core/TextInput'
import { Tooltip } from '@astryxdesign/core/Tooltip'
import type { CustomerFilters, FilterOptions } from '@/lib/features/customers/types'

type Props = {
  projectName: string
  filters: CustomerFilters
  options: FilterOptions
  total: number
  /** Customers whose address hasn't been looked up yet. */
  pending: number
  /** Looked up, but the address wasn't found. */
  notFound: number
  /** Pinned at the ZIP code because the street wasn't found. */
  approximate: number
}

/** A text filter mirrored into the URL (debounced); `applied` is its current URL value. */
function useDebouncedFilter(
  key: 'search' | 'zipcode',
  applied: string,
  apply: (next: Partial<CustomerFilters>) => void,
) {
  const [text, setText] = useState(applied)
  const appliedText = useRef(applied)

  // Debounce typing into the URL.
  useEffect(() => {
    if (text === appliedText.current) return
    const timer = setTimeout(() => {
      appliedText.current = text
      apply({ [key]: text })
    }, 400)
    return () => clearTimeout(timer)
  }, [text, key, apply])

  // Someone else changed the URL (e.g. "Clear filters"): follow it.
  useEffect(() => {
    if (applied !== appliedText.current) {
      appliedText.current = applied
      setText(applied)
    }
  }, [applied])

  return [text, setText] as const
}

export function FilterToolbar({ projectName, filters, options, total, pending, notFound, approximate }: Props) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [isPending, startTransition] = useTransition()

  // The params of the newest navigation, landed or not. Building each change on
  // `searchParams` alone would drop a filter whose navigation is still in flight
  // (type a search, then a ZIP before the page answers).
  const latestParams = useRef(searchParams.toString())
  useEffect(() => {
    if (!isPending) latestParams.current = searchParams.toString()
  }, [searchParams, isPending])

  const apply = useCallback(
    (next: Partial<CustomerFilters>) => {
      const params = new URLSearchParams(latestParams.current)
      for (const [key, value] of Object.entries(next)) {
        if (value) params.set(key, value)
        else params.delete(key)
      }
      latestParams.current = params.toString()
      startTransition(() => router.replace(`${pathname}?${params}`))
    },
    [pathname, router],
  )

  // Pins land about one a second while an upload is being looked up: pull them in.
  const isMapping = pending > 0
  useEffect(() => {
    if (!isMapping) return
    const timer = setInterval(() => router.refresh(), 5000)
    return () => clearInterval(timer)
  }, [isMapping, router])

  const [search, setSearch] = useDebouncedFilter('search', filters.search, apply)
  const [zipcode, setZipcode] = useDebouncedFilter('zipcode', filters.zipcode, apply)

  return (
    <LayoutHeader hasDivider>
      <HStack gap={2} wrap="wrap" align="center" justify="between">
        <HStack gap={2} wrap="wrap" align="center">
          <Text weight="semibold">{projectName}</Text>
          <Selector
            size="sm"
            width={110}
            label="State"
            isLabelHidden
            placeholder="State"
            options={options.states}
            value={filters.state || null}
            hasClear
            onChange={(value) => apply({ state: value ?? '', county: '', city: '' })}
          />
          <Selector
            size="sm"
            width={170}
            label="County"
            isLabelHidden
            placeholder="County"
            options={options.counties}
            value={filters.county || null}
            hasClear
            hasSearch
            onChange={(value) => apply({ county: value ?? '', city: '' })}
          />
          <Selector
            size="sm"
            width={170}
            label="City"
            isLabelHidden
            placeholder="City"
            options={options.cities}
            value={filters.city || null}
            hasClear
            hasSearch
            onChange={(value) => apply({ city: value ?? '' })}
          />
          <TextInput
            size="sm"
            width={220}
            label="Search address"
            isLabelHidden
            placeholder="Search address"
            startIcon="search"
            value={search}
            onChange={setSearch}
            hasClear
            isLoading={isPending}
          />
          <TextInput
            size="sm"
            width={110}
            label="ZIP code"
            isLabelHidden
            placeholder="ZIP code"
            value={zipcode}
            onChange={setZipcode}
            hasClear
          />
        </HStack>
        <HStack gap={2} align="center">
          {isMapping && <Spinner size="sm" aria-label="Mapping customers" />}
          <Text type="supporting">
            {total} {total === 1 ? 'customer' : 'customers'}
            {isMapping ? ` · Mapping ${pending}…` : ''}
            {notFound > 0 ? ` · ${notFound} ${notFound === 1 ? 'address' : 'addresses'} not found` : ''}
          </Text>
          {approximate > 0 && (
            <Tooltip content="Street not found. These pins are at the ZIP code.">
              <Badge
                variant="warning"
                label={`${approximate} approximate ${approximate === 1 ? 'location' : 'locations'}`}
              />
            </Tooltip>
          )}
        </HStack>
      </HStack>
    </LayoutHeader>
  )
}
