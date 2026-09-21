'use client'

import { useActionState, useState } from 'react'
import { Banner } from '@astryxdesign/core/Banner'
import { Button } from '@astryxdesign/core/Button'
import { Dialog, DialogHeader } from '@astryxdesign/core/Dialog'
import { Layout, LayoutContent, LayoutFooter } from '@astryxdesign/core/Layout'
import { HStack, VStack } from '@astryxdesign/core/Stack'
import { TextInput } from '@astryxdesign/core/TextInput'
import { createProjectAction, renameProjectAction } from '@/lib/features/projects/api'
import type { CreateProjectState, Project } from '@/lib/features/projects/types'

type FormProps = {
  title: string
  submitLabel: string
  pendingLabel: string
  initialName?: string
  action: (prev: CreateProjectState, formData: FormData) => Promise<CreateProjectState>
  onClose: () => void
}

function ProjectForm({ title, submitLabel, pendingLabel, initialName = '', action, onClose }: FormProps) {
  const [state, formAction, pending] = useActionState(action, null)
  const [name, setName] = useState(initialName)
  const error = state?.errors?.name?.[0]

  return (
    <form action={formAction}>
      <Layout
        header={<DialogHeader title={title} onOpenChange={onClose} />}
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
                label={pending ? pendingLabel : submitLabel}
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
        {isOpen && (
          // On success the action redirects to the new project, so only failures come back here.
          <ProjectForm
            title="New project"
            submitLabel="Create project"
            pendingLabel="Creating…"
            action={createProjectAction}
            onClose={() => setOpen(false)}
          />
        )}
      </Dialog>
    </>
  )
}

/** Open while `project` is set. */
export function RenameProjectDialog({ project, onClose }: { project: Project | null; onClose: () => void }) {
  return (
    <Dialog isOpen={project !== null} onOpenChange={(open) => !open && onClose()} purpose="form" width={480}>
      {project && (
        <ProjectForm
          title="Rename project"
          submitLabel="Save"
          pendingLabel="Saving…"
          initialName={project.name}
          action={async (prev, formData) => {
            const state = await renameProjectAction(project.id, prev, formData)
            if (!state) onClose()
            return state
          }}
          onClose={onClose}
        />
      )}
    </Dialog>
  )
}
