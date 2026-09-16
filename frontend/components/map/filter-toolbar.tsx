'use client'

import { useCallback, useEffect, useRef, useState, useTransition } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { LayoutHeader } from '@astryxdesign/core/Layout'
import { Selector } from '@astryxdesign/core/Selector'
import { HStack } from '@astryxdesign/core/Stack'
import { Text } from '@astryxdesign/core/Text'
import { TextInput } from '@astryxdesign/core/TextInput'
import type { CustomerFilters, FilterOptions } from '@/lib/features/customers/types'

type Props = {
  projectName: string
  filters: CustomerFilters
  options: FilterOptions
  total: number
  unpinned: number
}

export function FilterToolbar({ projectName, filters, options, total, unpinned }: Props) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [isPending, startTransition] = useTransition()
  const [search, setSearch] = useState(filters.search)
  const appliedSearch = useRef(filters.search)

  const apply = useCallback(
    (next: Partial<CustomerFilters>) => {
      const params = new URLSearchParams(searchParams)
      for (const [key, value] of Object.entries(next)) {
        if (value) params.set(key, value)
        else params.delete(key)
      }
      startTransition(() => router.replace(`${pathname}?${params}`))
    },
    [pathname, router, searchParams],
  )

  // Debounce typing into the URL.
  useEffect(() => {
    if (search === appliedSearch.current) return
    const timer = setTimeout(() => {
      appliedSearch.current = search
      apply({ search })
    }, 400)
    return () => clearTimeout(timer)
  }, [search, apply])

  // Someone else changed the URL (e.g. "Clear filters"): follow it.
  useEffect(() => {
    if (filters.search !== appliedSearch.current) {
      appliedSearch.current = filters.search
      setSearch(filters.search)
    }
  }, [filters.search])

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
            label="Search address or ZIP"
            isLabelHidden
            placeholder="Search address or ZIP"
            startIcon="search"
            value={search}
            onChange={setSearch}
            hasClear
            isLoading={isPending}
          />
        </HStack>
        <Text type="supporting">
          {total} {total === 1 ? 'customer' : 'customers'}
          {unpinned > 0 ? ` · ${unpinned} without a map pin` : ''}
        </Text>
      </HStack>
    </LayoutHeader>
  )
}
