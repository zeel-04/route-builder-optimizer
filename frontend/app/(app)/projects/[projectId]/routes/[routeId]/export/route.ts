import { proxyDownload } from '@/lib/client'

export async function GET(_req: Request, { params }: { params: Promise<{ routeId: string }> }) {
  const { routeId } = await params
  return proxyDownload(`/routes/${routeId}/export/`)
}
