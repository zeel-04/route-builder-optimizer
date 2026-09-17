'use client'

import { useActionState, useState } from 'react'
import { Banner } from '@astryxdesign/core/Banner'
import { Button } from '@astryxdesign/core/Button'
import { Dialog, DialogHeader } from '@astryxdesign/core/Dialog'
import { Layout, LayoutContent, LayoutFooter } from '@astryxdesign/core/Layout'
import { HStack, VStack } from '@astryxdesign/core/Stack'
import { TextInput } from '@astryxdesign/core/TextInput'
import { createProjectAction } from '@/lib/features/projects/api'

function NewProjectForm({ onClose }: { onClose: () => void }) {
  // On success the action redirects to the new project, so only failures come back here.
  const [state, formAction, pending] = useActionState(createProjectAction, null)
  const [name, setName] = useState('')
  const error = state?.errors?.name?.[0]

  return (
    <form action={formAction}>
      <Layout
        header={<DialogHeader title="New project" onOpenChange={onClose} />}
        content={
          <LayoutContent>
            <VStack gap={4}>
              {state?.message && <Banner status="error" title={state.message} />}
              <TextInput
                label="Project name"
                htmlName="name"
                value={name}
                onChange={setName}
                status={error ? { type: 'error', message: error } : undefined}
                hasAutoFocus
              />
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
                label={pending ? 'Creating…' : 'Create project'}
                isLoading={pending}
              />
            </HStack>
          </LayoutFooter>
        }
      />
    </form>
  )
}

export function NewProjectButton() {
  const [isOpen, setOpen] = useState(false)
  return (
    <>
      <Button variant="primary" label="New project" onClick={() => setOpen(true)} />
      <Dialog isOpen={isOpen} onOpenChange={setOpen} purpose="form" width={480}>
        {/* Mounted only while open, so a reopened dialog starts clean. */}
        {isOpen && <NewProjectForm onClose={() => setOpen(false)} />}
      </Dialog>
    </>
  )
}
