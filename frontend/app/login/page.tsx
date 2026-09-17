import { Center } from '@astryxdesign/core/Center'
import { ssoEnabled } from '@/lib/features/auth/oidc'
import { LoginForm } from './login-form'
import { SsoCard } from './sso-card'

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>
}) {
  const { error } = await searchParams

  return (
    <Center minHeight="100dvh" padding={4}>
      {ssoEnabled ? <SsoCard error={error} /> : <LoginForm />}
    </Center>
  )
}
