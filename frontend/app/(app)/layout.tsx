import { AppFrame } from '@/components/app-frame'
import { getMe } from '@/lib/features/auth/api'

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await getMe()
  return <AppFrame user={user}>{children}</AppFrame>
}
