import { Button } from '@astryxdesign/core/Button'
import { Center } from '@astryxdesign/core/Center'
import { EmptyState } from '@astryxdesign/core/EmptyState'

export default function NotFound() {
  return (
    <Center minHeight="100dvh" padding={6}>
      <EmptyState
        title="Page not found"
        description="This route may have been deleted, or the link is wrong."
        actions={<Button variant="primary" label="Go to projects" href="/projects" />}
      />
    </Center>
  )
}
