'use client'

import { useActionState, useState } from 'react'
import { Banner } from '@astryxdesign/core/Banner'
import { Button } from '@astryxdesign/core/Button'
import { Dialog, DialogHeader } from '@astryxdesign/core/Dialog'
import { FormLayout } from '@astryxdesign/core/FormLayout'
import { Layout, LayoutContent, LayoutFooter } from '@astryxdesign/core/Layout'
import { HStack, VStack } from '@astryxdesign/core/Stack'
import { TextInput } from '@astryxdesign/core/TextInput'
import { useToast } from '@astryxdesign/core/Toast'
import { addCustomerAction, updateCustomerAction } from '@/lib/features/customers/api'
import type { AddCustomerState, Customer, CustomerCreate } from '@/lib/features/customers/types'

type Field = keyof CustomerCreate

const FIELDS: { name: Field; label: string; autoComplete: string; isOptional?: boolean; description?: string }[] = [
  { name: 'customer_code', label: 'Customer code', autoComplete: 'off' },
  { name: 'name', label: 'Name', autoComplete: 'organization' },
  { name: 'address', label: 'Address', autoComplete: 'address-line1' },
  { name: 'address2', label: 'Address line 2', autoComplete: 'address-line2', isOptional: true },
  { name: 'state', label: 'State', autoComplete: 'address-level1', description: '2-letter code, like TX' },
  { name: 'zipcode', label: 'ZIP code', autoComplete: 'postal-code' },
]

const EMPTY: Record<Field, string> = { customer_code: '', name: '', address: '', address2: '', state: '', zipcode: '' }

type FormProps = { projectId: string; customer?: Customer; onClose: () => void }

/** Adds a customer, or edits `customer` when given. */
function CustomerForm({ projectId, customer, onClose }: FormProps) {
  const toast = useToast()
  const [values, setValues] = useState(() =>
    customer ? (Object.fromEntries(FIELDS.map((f) => [f.name, customer[f.name]])) as Record<Field, string>) : EMPTY,
  )
  const [state, formAction, pending] = useActionState(async (_prev: AddCustomerState, formData: FormData) => {
    const result = customer
      ? await updateCustomerAction(projectId, customer.id, formData)
      : await addCustomerAction(projectId, formData)
    if (result?.ok) {
      toast({ body: `${customer ? 'Saved' : 'Added'} ${formData.get('name')}` })
      onClose()
    }
    return result
  }, null)

  const errorFor = (field: Field) => {
    const message = state?.ok === false ? state.errors?.[field]?.[0] : undefined
    return message ? { type: 'error' as const, message } : undefined
  }
  // Form-level problems only (e.g. duplicate code); field problems sit under their fields.
  const bannerMessage = state?.ok === false ? state.message : undefined

  return (
    <form action={formAction}>
      <Layout
        header={<DialogHeader title={customer ? 'Edit customer' : 'Add customer'} onOpenChange={onClose} />}
        content={
          <LayoutContent>
            <VStack gap={4}>
              {bannerMessage && <Banner status="error" title={bannerMessage} />}
              <FormLayout defaultOptionality="required">
                {FIELDS.map((field, i) => (
                  <TextInput
                    key={field.name}
                    label={field.label}
                    htmlName={field.name}
                    autoComplete={field.autoComplete}
                    isOptional={field.isOptional}
                    description={field.description}
                    value={values[field.name]}
                    onChange={(value) => setValues((v) => ({ ...v, [field.name]: value }))}
                    status={errorFor(field.name)}
                    hasAutoFocus={i === 0}
                  />
                ))}
              </FormLayout>
            </VStack>
          </LayoutContent>
        }
        footer={
          <LayoutFooter>
            <HStack gap={2} hAlign="end">
              <Button label="Cancel" variant="secondary" onClick={onClose} />
              <Button
                type="submit"
                variant="primary"
                label={customer ? (pending ? 'Saving…' : 'Save changes') : pending ? 'Adding…' : 'Add customer'}
                isLoading={pending}
              />
            </HStack>
          </LayoutFooter>
        }
      />
    </form>
  )
}

export function AddCustomerButton({ projectId }: { projectId: string }) {
  const [isOpen, setOpen] = useState(false)
  return (
    <>
      <Button variant="secondary" label="Add customer" onClick={() => setOpen(true)} />
      <Dialog isOpen={isOpen} onOpenChange={setOpen} purpose="form" width={480}>
        {isOpen && <CustomerForm projectId={projectId} onClose={() => setOpen(false)} />}
      </Dialog>
    </>
  )
}

/** Open while `customer` is set. */
export function EditCustomerDialog({ projectId, customer, onClose }: { projectId: string; customer: Customer | null; onClose: () => void }) {
  return (
    <Dialog isOpen={!!customer} onOpenChange={(open) => !open && onClose()} purpose="form" width={480}>
      {customer && <CustomerForm projectId={projectId} customer={customer} onClose={onClose} />}
    </Dialog>
  )
}
