'use client'

import { EmptyState } from '@astryxdesign/core/EmptyState'
import { Heading } from '@astryxdesign/core/Heading'
import { Icon } from '@astryxdesign/core/Icon'
import { Layout, LayoutContent, LayoutHeader } from '@astryxdesign/core/Layout'
import { List, ListItem } from '@astryxdesign/core/List'
import { HStack } from '@astryxdesign/core/Stack'
import { NewProjectButton } from '@/components/projects/new-project-dialog'
import type { Project } from '@/lib/features/projects/types'

const plural = (n: number, word: string) => `${n.toLocaleString()} ${n === 1 ? word : `${word}s`}`

export function ProjectsScreen({ projects }: { projects: Project[] }) {
  return (
    <Layout
      contentWidth={960}
      padding={4}
      header={
        <LayoutHeader paddingBlockEnd={6} style={{ paddingBlockStart: 'var(--spacing-4)' }}>
          <HStack justify="between" align="center">
            <Heading level={1}>Projects</Heading>
            {projects.length > 0 && <NewProjectButton />}
          </HStack>
        </LayoutHeader>
      }
      content={
        <LayoutContent>
          {projects.length === 0 ? (
            <EmptyState
              title="No projects yet"
              description="A project holds a set of customers and the routes built from them."
              actions={<NewProjectButton />}
            />
          ) : (
            // ListItem href makes the whole row the link, which a Table cell can't.
            <List hasDividers>
              {projects.map((project) => (
                <ListItem
                  key={project.id}
                  href={`/projects/${project.id}`}
                  label={project.name}
                  description={`${plural(project.customer_count, 'customer')} · ${plural(project.route_count, 'route')}`}
                  endContent={<Icon icon="chevronRight" size="sm" color="secondary" />}
                />
              ))}
            </List>
          )}
        </LayoutContent>
      }
    />
  )
}
