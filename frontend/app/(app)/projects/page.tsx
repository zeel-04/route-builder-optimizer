import { redirect } from 'next/navigation'
import { ProjectsScreen } from '@/components/projects/projects-screen'
import { ApiError } from '@/lib/client'
import { listProjects } from '@/lib/features/projects/api'
import { PROJECT_PAGE_SIZE } from '@/lib/features/projects/types'

type Props = { searchParams: Promise<{ page?: string | string[]; q?: string | string[] }> }

/** Reads one projects page; a page past the end (say, after deleting its last row) redirects to the last one. */
async function readProjectPage(page: number, search: string) {
  try {
    return await listProjects(page, search)
  } catch (err) {
    if (!(err instanceof ApiError && err.status === 404) || page === 1) throw err
  }
  const { count } = await listProjects(1, search)
  const last = Math.ceil(count / PROJECT_PAGE_SIZE)
  const params = new URLSearchParams()
  if (search) params.set('q', search)
  if (last > 1) params.set('page', String(last))
  redirect(params.size ? `/projects?${params}` : '/projects')
}

export default async function ProjectsPage({ searchParams }: Props) {
  const query = await searchParams
  const page = Math.max(1, Math.floor(Number(query.page)) || 1)
  const search = typeof query.q === 'string' ? query.q.trim() : ''

  const projects = await readProjectPage(page, search)
  // A search with no matches still shows the search bar, as long as there are projects at all.
  const hasProjects = projects.count > 0 || (!!search && (await listProjects(1)).count > 0)

  return (
    <ProjectsScreen
      projects={projects.results}
      page={page}
      total={projects.count}
      search={search}
      hasProjects={hasProjects}
    />
  )
}
