'use client'

import { EmptyState } from '@astryxdesign/core/EmptyState'
import { Heading } from '@astryxdesign/core/Heading'
import { Icon } from '@astryxdesign/core/Icon'
import { Layout, LayoutContent, LayoutHeader } from '@astryxdesign/core/Layout'
import { List, ListItem } from '@astryxdesign/core/List'
import type { Project } from '@/lib/features/projects/types'

const plural = (n: number, word: string) => `${n.toLocaleString()} ${n === 1 ? word : `${word}s`}`

export function ProjectsScreen({ projects }: { projects: Project[] }) {
  return (
    <Layout
      contentWidth={960}
      padding={4}
      header={
        <LayoutHeader>
          <Heading level={1}>Projects</Heading>
        </LayoutHeader>
      }
      content={
        <LayoutContent>
          {projects.length === 0 ? (
            <EmptyState title="No projects yet" description="Ask an admin to create one in the admin panel." />
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
