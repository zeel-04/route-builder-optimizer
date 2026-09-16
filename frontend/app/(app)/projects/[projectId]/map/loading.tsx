import { Layout, LayoutContent, LayoutHeader, LayoutPanel } from '@astryxdesign/core/Layout'
import { Skeleton } from '@astryxdesign/core/Skeleton'
import { HStack, VStack } from '@astryxdesign/core/Stack'

export default function Loading() {
  return (
    <Layout
      header={
        <LayoutHeader hasDivider>
          <HStack gap={2} align="center">
            <Skeleton width={110} height={28} />
            <Skeleton width={170} height={28} index={1} />
            <Skeleton width={170} height={28} index={2} />
            <Skeleton width={220} height={28} index={3} />
          </HStack>
        </LayoutHeader>
      }
      content={
        <LayoutContent padding={0}>
          <Skeleton radius="none" />
        </LayoutContent>
      }
      end={
        <LayoutPanel width={380} hasDivider padding={4}>
          <VStack gap={4}>
            <Skeleton width={140} height={28} />
            <Skeleton height={32} index={1} />
            <Skeleton height={32} index={2} />
            <Skeleton height={160} index={3} />
          </VStack>
        </LayoutPanel>
      }
    />
  )
}
