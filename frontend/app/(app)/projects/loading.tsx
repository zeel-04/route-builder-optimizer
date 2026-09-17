import { Layout, LayoutContent, LayoutHeader } from '@astryxdesign/core/Layout'
import { Skeleton } from '@astryxdesign/core/Skeleton'
import { HStack, VStack } from '@astryxdesign/core/Stack'

export default function Loading() {
  return (
    <Layout
      contentWidth={960}
      padding={4}
      header={
        <LayoutHeader paddingBlockEnd={6} style={{ paddingBlockStart: 'var(--spacing-4)' }}>
          <HStack justify="between" align="center">
            <Skeleton width={120} height={32} />
            <Skeleton width={110} height={32} index={1} />
          </HStack>
        </LayoutHeader>
      }
      content={
        <LayoutContent>
          <VStack gap={3}>
            {[0, 1, 2, 3, 4].map((i) => (
              <Skeleton key={i} height={40} index={i + 2} />
            ))}
          </VStack>
        </LayoutContent>
      }
    />
  )
}
