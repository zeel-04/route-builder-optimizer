import { ProjectsScreen } from '@/components/projects/projects-screen'
import { listProjects } from '@/lib/features/projects/api'

export default async function ProjectsPage() {
  const projects = await listProjects()
  return <ProjectsScreen projects={projects} />
}
