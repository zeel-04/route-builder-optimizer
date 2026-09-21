'use client'

import { useState, useTransition } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { AlertDialog } from '@astryxdesign/core/AlertDialog'
import { Button } from '@astryxdesign/core/Button'
import { EmptyState } from '@astryxdesign/core/EmptyState'
import { Icon } from '@astryxdesign/core/Icon'
import { Layout, LayoutContent, LayoutHeader } from '@astryxdesign/core/Layout'
import { Link } from '@astryxdesign/core/Link'
import { MoreMenu } from '@astryxdesign/core/MoreMenu'
import { Pagination } from '@astryxdesign/core/Pagination'
import { HStack, VStack } from '@astryxdesign/core/Stack'
import { pixel, Table, type TableColumn } from '@astryxdesign/core/Table'
import { TextInput } from '@astryxdesign/core/TextInput'
import { Timestamp } from '@astryxdesign/core/Timestamp'
import { useToast } from '@astryxdesign/core/Toast'
import { NewProjectButton, RenameProjectDialog } from '@/components/projects/new-project-dialog'
import { tableRowLink } from '@/components/table-row-link'
import { useUrlSearch } from '@/components/use-url-search'
import { deleteProjectAction } from '@/lib/features/projects/api'
import { PROJECT_PAGE_SIZE, type Project } from '@/lib/features/projects/types'

type Props = {
  /** One page (`?page=`), most recently updated first, already filtered by `search` (`?q=`). */
  projects: Project[]
  page: number
  /** Projects matching `search`, across all pages. */
  total: number
  search: string
  /** Whether there are any projects at all, regardless of `search`. */
  hasProjects: boolean
}

const projectHref = (project: Project) => `/projects/${project.id}`

const plural = (n: number, word: string) => `${n.toLocaleString()} ${n === 1 ? word : `${word}s`}`

export function ProjectsScreen({ projects, page, total, search, hasProjects }: Props) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const { text, setText, clear: clearSearch, isSearching } = useUrlSearch(search)
  const rowLink = tableRowLink<Project>((href) => router.push(href), projectHref)
  const toast = useToast()
  const [renaming, setRenaming] = useState<Project | null>(null)
  const [deleting, setDeleting] = useState<Project | null>(null)
  const [isDeleting, startDelete] = useTransition()

  function goTo(next: number) {
    const params = new URLSearchParams(searchParams)
    if (next > 1) params.set('page', String(next))
    else params.delete('page')
    router.push(params.size ? `${pathname}?${params}` : pathname, { scroll: false })
  }

  function remove() {
    if (!deleting) return
    startDelete(async () => {
      await deleteProjectAction(deleting.id)
      toast({ body: `Deleted “${deleting.name}”` })
      setDeleting(null)
    })
  }

  const columns: TableColumn<Project>[] = [
    {
      key: 'name',
      header: 'Project',
      renderCell: (project) => <Link href={projectHref(project)}>{project.name}</Link>,
    },
    { key: 'customer_count', header: 'Customers', width: pixel(120), align: 'end' },
    { key: 'route_count', header: 'Routes', width: pixel(100), align: 'end' },
    {
      key: 'created_at',
      header: 'Created',
      width: pixel(150),
      renderCell: (project) => <Timestamp value={project.created_at} />,
    },
    {
      key: 'updated_at',
      header: 'Updated',
      width: pixel(150),
      renderCell: (project) => <Timestamp value={project.updated_at} />,
    },
    {
      key: 'id',
      header: 'Actions',
      width: pixel(90),
      align: 'end',
      renderCell: (project) => (
        <MoreMenu
          label={`Actions for ${project.name}`}
          size="sm"
          alignment="end"
          items={[
            { label: 'Rename', onClick: () => setRenaming(project) },
            { label: 'Delete', variant: 'destructive', onClick: () => setDeleting(project) },
          ]}
        />
      ),
    },
  ]

  return (
    <>
      <Layout
        contentWidth={960}
        padding={4}
        header={
          hasProjects && (
            <LayoutHeader paddingBlockEnd={2} style={{ paddingBlockStart: 'var(--spacing-4)' }}>
              <HStack justify="between" align="center" gap={2} wrap="wrap">
                <TextInput
                  width={280}
                  label="Search projects"
                  isLabelHidden
                  placeholder="Search projects"
                  startIcon="search"
                  value={text}
                  onChange={setText}
                  hasClear
                  isLoading={isSearching}
                />
                <NewProjectButton />
              </HStack>
            </LayoutHeader>
          )
        }
        content={
          // padding={4}: Table bleeds 16px, and the scrolling content region would clip its header otherwise
          <LayoutContent padding={4}>
            {!hasProjects ? (
              <EmptyState
                title="No projects yet"
                description="A project holds a set of customers and the routes built from them."
                actions={<NewProjectButton />}
              />
            ) : projects.length === 0 ? (
              <EmptyState
                icon={<Icon icon="search" size="lg" color="secondary" />}
                title="No projects match"
                description={`Nothing matches “${search}”. Try a different project name.`}
                actions={<Button label="Clear search" variant="secondary" onClick={clearSearch} />}
              />
            ) : (
              <VStack gap={4}>
                <Table data={projects} columns={columns} idKey="id" hasHover plugins={{ rowLink }} />
                {total > PROJECT_PAGE_SIZE && (
                  <Pagination
                    variant="count"
                    size="sm"
                    page={page}
                    pageSize={PROJECT_PAGE_SIZE}
                    totalItems={total}
                    onChange={goTo}
                    label="Project pages"
                  />
                )}
              </VStack>
            )}
          </LayoutContent>
        }
      />

      <RenameProjectDialog project={renaming} onClose={() => setRenaming(null)} />

      <AlertDialog
        isOpen={deleting !== null}
        onOpenChange={(open) => !open && setDeleting(null)}
        title={`Delete project “${deleting?.name ?? ''}”?`}
        description={
          deleting && deleting.customer_count + deleting.route_count > 0
            ? `This also deletes its ${plural(deleting.customer_count, 'customer')} and ${plural(deleting.route_count, 'route')}. This can't be undone.`
            : "This can't be undone."
        }
        actionLabel="Delete project"
        isActionLoading={isDeleting}
        onAction={remove}
      />
    </>
  )
}
