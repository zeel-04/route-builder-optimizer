'use client'

import { usePathname } from 'next/navigation'
import { AppShell } from '@astryxdesign/core/AppShell'
import { Button } from '@astryxdesign/core/Button'
import { HStack } from '@astryxdesign/core/Stack'
import { Text } from '@astryxdesign/core/Text'
import { TopNav, TopNavHeading, TopNavItem } from '@astryxdesign/core/TopNav'
import { logoutAction } from '@/lib/features/auth/api'
import type { User } from '@/lib/features/auth/types'

export function AppFrame({ user, children }: { user: User; children: React.ReactNode }) {
  const pathname = usePathname()
  // Inside a project, Map opens that project's map; everywhere else, the explore map.
  const projectPath = pathname.match(/^\/projects\/[^/]+/)?.[0]
  const isMap = pathname.endsWith('/map') // /map and /projects/<id>/map

  return (
    <AppShell
      topNav={
        <TopNav
          label="Main navigation"
          heading={<TopNavHeading heading="Route Builder" subheading={user.tenant.name} headingHref="/projects" />}
          startContent={
            <>
              <TopNavItem label="Projects" href="/projects" isSelected={pathname.startsWith('/projects') && !isMap} />
              <TopNavItem label="Map" href={projectPath ? `${projectPath}/map` : '/map'} isSelected={isMap} />
            </>
          }
          endContent={
            <HStack gap={3} align="center">
              <Text color="secondary">{user.name}</Text>
              <form action={logoutAction}>
                <Button type="submit" variant="ghost" size="sm" label="Sign out" />
              </form>
            </HStack>
          }
        />
      }
    >
      {children}
    </AppShell>
  )
}
