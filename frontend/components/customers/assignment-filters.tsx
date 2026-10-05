'use client'

import { Badge } from '@astryxdesign/core/Badge'
import { Button } from '@astryxdesign/core/Button'
import { HStack } from '@astryxdesign/core/Stack'
import type { AssignmentFilter, AssignmentSummary } from '@/lib/features/customers/types'

export function AssignmentFilters({ value, summary, onChange, isDisabled = false }: {
  value: AssignmentFilter
  summary: Pick<AssignmentSummary, 'total' | 'assigned' | 'unassigned'>
  onChange: (value: AssignmentFilter) => void
  isDisabled?: boolean
}) {
  return (
    <HStack gap={1} wrap="wrap" role="group" aria-label="Customer assignment filters">
      {(['all', 'assigned', 'unassigned'] as const).map((key) => {
        const label = key === 'all' ? 'All' : key === 'assigned' ? 'Assigned' : 'Unassigned'
        const count = key === 'all' ? summary.total : summary[key]
        return (
          <Button
            key={key}
            size="sm"
            variant={value === key ? 'secondary' : 'ghost'}
            label={`${label} (${count})`}
            aria-pressed={value === key}
            isDisabled={isDisabled}
            onClick={() => onChange(key)}
            endContent={<Badge label={String(count)} />}
          >
            {label}
          </Button>
        )
      })}
    </HStack>
  )
}
