'use client'

import type { SVGProps } from 'react'
import { usePathname } from 'next/navigation'
import { AppShell } from '@astryxdesign/core/AppShell'
import { Avatar } from '@astryxdesign/core/Avatar'
import { Button } from '@astryxdesign/core/Button'
import { Divider } from '@astryxdesign/core/Divider'
import { Icon } from '@astryxdesign/core/Icon'
import { Popover } from '@astryxdesign/core/Popover'
import { VStack } from '@astryxdesign/core/Stack'
import { Text } from '@astryxdesign/core/Text'
import { TopNav, TopNavHeading, TopNavItem } from '@astryxdesign/core/TopNav'
import { logoutAction } from '@/lib/features/auth/api'
import type { User } from '@/lib/features/auth/types'

// Lucide "route" icon (ISC licence), inlined rather than adding lucide-react for one glyph.
function RouteIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" {...props}>
      <circle cx="6" cy="19" r="3" />
      <path d="M9 19h8.5a3.5 3.5 0 0 0 0-7h-11a3.5 3.5 0 0 1 0-7H15" />
      <circle cx="18" cy="5" r="3" />
    </svg>
  )
}

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
          style={{ paddingInline: 'var(--spacing-6)' }}
          heading={<TopNavHeading
              logo={<Icon icon={RouteIcon} size="md" />}
              heading="Route Builder"
              headingHref="/projects"
            />}
          startContent={
            <>
              <TopNavItem label="Projects" href="/projects" isSelected={pathname.startsWith('/projects') && !isMap} />
              <TopNavItem label="Map" href={projectPath ? `${projectPath}/map` : '/map'} isSelected={isMap} />
            </>
          }
          endContent={
            <Popover
              label="Account"
              placement="below"
              alignment="end"
              width={280}
              content={
                <VStack gap={2}>
                  <VStack gap={0.5}>
                    <Text weight="semibold">{user.name}</Text>
                    <Text color="secondary">{user.email}</Text>
                    <Text color="secondary">{user.tenant.name}</Text>
                  </VStack>
                  <Divider />
                  <form action={logoutAction}>
                    {/* Astryx has no outlined-danger variant; secondary + error tokens gives one. */}
                    <Button
                      type="submit"
                      variant="secondary"
                      size="sm"
                      width="100%"
                      label="Sign out"
                      style={{ color: 'var(--color-error)', borderColor: 'var(--color-error)' }}
                    />
                  </form>
                </VStack>
              }
            >
              {/* onClick makes Avatar render a <button>, which Popover needs as its trigger. */}
              <Avatar
                name={user.name}
                size="sm"
                // 28px sits between the allowed 24 and 32 steps.
                style={{ width: 'var(--spacing-7)', height: 'var(--spacing-7)' }}
                tooltip={false}
                alt="Account menu"
                onClick={() => {}}
              />
            </Popover>
          }
        />
      }
    >
      {children}
    </AppShell>
  )
}
