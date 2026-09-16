import { RoutesScreen } from '@/components/routes/routes-screen'
import { getProject } from '@/lib/features/projects/api'
import { listRoutes } from '@/lib/features/routes/api'
import { or404 } from './or-404'

type Props = { params: Promise<{ projectId: string }> }

export default async function ProjectRoutesPage({ params }: Props) {
  const { projectId } = await params
  const [project, routes] = await or404(Promise.all([getProject(projectId), listRoutes(projectId)]))
  return <RoutesScreen project={project} routes={routes} />
}
