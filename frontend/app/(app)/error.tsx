'use client'

import { Button } from '@astryxdesign/core/Button'
import { Center } from '@astryxdesign/core/Center'
import { EmptyState } from '@astryxdesign/core/EmptyState'
import { Icon } from '@astryxdesign/core/Icon'

export default function ErrorPage({ retry }: { error: Error & { digest?: string }; retry: () => void }) {
  return (
    <Center minHeight="100%" padding={6}>
      <EmptyState
        icon={<Icon icon="error" size="lg" color="error" />}
        title="We couldn't load this page"
        description="Check your connection and that the server is running, then try again."
        actions={<Button variant="primary" label="Try again" onClick={() => retry()} />}
      />
    </Center>
  )
}
