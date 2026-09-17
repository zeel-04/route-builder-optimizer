import { proxyDownload } from '@/lib/client'

export async function GET(_req: Request, { params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params
  return proxyDownload(`/projects/${projectId}/customers/export/`)
}
