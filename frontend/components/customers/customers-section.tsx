'use client'

import { useState, useTransition } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { AlertDialog } from '@astryxdesign/core/AlertDialog'
import { Button } from '@astryxdesign/core/Button'
import { DropdownMenu } from '@astryxdesign/core/DropdownMenu'
import { EmptyState } from '@astryxdesign/core/EmptyState'
import { Icon } from '@astryxdesign/core/Icon'
import { Pagination } from '@astryxdesign/core/Pagination'
import { HStack, VStack } from '@astryxdesign/core/Stack'
import { Table, pixel, type TableColumn } from '@astryxdesign/core/Table'
import { TextInput } from '@astryxdesign/core/TextInput'
import { useToast } from '@astryxdesign/core/Toast'
import { Token } from '@astryxdesign/core/Token'
import { Tooltip } from '@astryxdesign/core/Tooltip'
import { AddCustomerButton, EditCustomerDialog } from '@/components/customers/add-customer-dialog'
import { UploadCustomersButton } from '@/components/customers/upload-customers-dialog'
import { useUrlSearch } from '@/components/use-url-search'
import { deleteCustomerAction } from '@/lib/features/customers/api'
import { CUSTOMER_PAGE_SIZE, LocationAccuracy, type Customer } from '@/lib/features/customers/types'

const columns: TableColumn<Customer>[] = [
  { key: 'customer_code', header: 'Code' },
  { key: 'name', header: 'Name' },
  {
    key: 'address',
    header: 'Address',
    renderCell: (c) => {
      const address = [c.address, c.address2].filter(Boolean).join(', ')
      if (c.location_accuracy !== LocationAccuracy.ZIP) return address
      return (
        <VStack gap={1} hAlign="start">
          {address}
          <Tooltip content="Street not found. The map pin is at the ZIP code.">
            <Token size="sm" color="yellow" label="Approximate" />
          </Tooltip>
        </VStack>
      )
    },
  },
  { key: 'city', header: 'City', renderCell: (c) => c.city || '—' },
  { key: 'state', header: 'State' },
  { key: 'zipcode', header: 'ZIP code' },
]

type Props = {
  projectId: string
  customers: Customer[]
  page: number
  total: number
  /** The `?q=` search; `total` counts its matches. */
  search: string
  /** Whether the project has any customers at all, regardless of `search`. */
  hasCustomers: boolean
}

/** `customers` is the current page only; the page itself lives in `?page=`. */
export function CustomersSection({ projectId, customers, page, total, search, hasCustomers }: Props) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const toast = useToast()
  const [isDeleting, startDelete] = useTransition()
  const { text, setText, clear: clearSearch, isSearching } = useUrlSearch(search)
  const [editing, setEditing] = useState<Customer | null>(null)
  // Kept after close so the dialog title doesn't blank out while it animates away.
  const [deleting, setDeleting] = useState<Customer | null>(null)
  const [isDeleteOpen, setDeleteOpen] = useState(false)

  function goTo(next: number) {
    const params = new URLSearchParams(searchParams)
    if (next > 1) params.set('page', String(next))
    else params.delete('page')
    router.push(params.size ? `${pathname}?${params}` : pathname, { scroll: false })
  }

  function remove() {
    if (!deleting) return
    startDelete(async () => {
      await deleteCustomerAction(projectId, deleting.id)
      toast({ body: `Deleted ${deleting.name}` })
      setDeleteOpen(false)
    })
  }

  const tableColumns: TableColumn<Customer>[] = [
    ...columns,
    {
      key: 'actions',
      header: 'Actions',
      width: pixel(96), // 64 clips the "Actions" header
      align: 'end',
      renderCell: (c) => (
        <DropdownMenu
          button={{
            label: `Actions for ${c.name}`,
            icon: <Icon icon="moreHorizontal" />,
            variant: 'ghost',
            isIconOnly: true,
          }}
          hasChevron={false}
          alignment="end"
          items={[
            { label: 'Edit', onClick: () => setEditing(c) },
            { type: 'divider' },
            { label: 'Delete', variant: 'destructive', onClick: () => {
                setDeleting(c)
                setDeleteOpen(true)
              },
            },
          ]}
        />
      ),
    },
  ]

  return (
    <VStack gap={4}>
      {hasCustomers && (
        <HStack justify="between" align="center" gap={2} wrap="wrap">
          <TextInput
            width={280}
            label="Search customers"
            isLabelHidden
            placeholder="Search customers"
            startIcon="search"
            value={text}
            onChange={setText}
            hasClear
            isLoading={isSearching}
          />
          <HStack gap={2}>
            {/* A plain <a>, not the app's Next Link: the export route answers with a file download. */}
            <Button
              label="Download CSV"
              variant="secondary"
              href={`/projects/${projectId}/customers/export`}
              as="a"
            />
            <UploadCustomersButton projectId={projectId} variant="secondary" />
            <AddCustomerButton projectId={projectId} />
          </HStack>
        </HStack>
      )}
      {!hasCustomers ? (
        <EmptyState
          title="No customers yet"
          description="Upload a CSV of your customer list, or add customers one at a time."
          actions={
            <HStack gap={2}>
              <AddCustomerButton projectId={projectId} />
              <UploadCustomersButton projectId={projectId} variant="primary" />
            </HStack>
          }
        />
      ) : total === 0 ? (
        <EmptyState
          icon={<Icon icon="search" size="lg" color="secondary" />}
          title="No customers match"
          description={`Nothing matches “${search}”. Try a different name, address, or code.`}
          actions={<Button label="Clear search" variant="secondary" onClick={clearSearch} />}
        />
      ) : (
        <>
          <Table data={customers} columns={tableColumns} idKey="id" />
          {total > CUSTOMER_PAGE_SIZE && (
            <Pagination
              variant="count"
              size="sm"
              page={page}
              pageSize={CUSTOMER_PAGE_SIZE}
              totalItems={total}
              onChange={goTo}
              label="Customer pages"
            />
          )}
        </>
      )}
      <EditCustomerDialog projectId={projectId} customer={editing} onClose={() => setEditing(null)} />
      <AlertDialog
        isOpen={isDeleteOpen}
        onOpenChange={setDeleteOpen}
        title={`Delete customer “${deleting?.name ?? ''}”?`}
        description="They're removed from this project and from any route they're on. This can't be undone."
        actionLabel="Delete customer"
        isActionLoading={isDeleting}
        onAction={remove}
      />
    </VStack>
  )
}
