import { Banner } from '@astryxdesign/core/Banner'
import { Button } from '@astryxdesign/core/Button'
import { Card } from '@astryxdesign/core/Card'
import { Heading } from '@astryxdesign/core/Heading'
import { VStack } from '@astryxdesign/core/Stack'
import { Text } from '@astryxdesign/core/Text'
import { ssoErrorMessage } from '@/lib/features/auth/sso-errors'

export function SsoCard({ error: code }: { error?: string }) {
  const error = ssoErrorMessage(code)

  return (
    <Card width="100%" maxWidth={400}>
      <VStack gap={6}>
        <VStack gap={1}>
          <Heading level={1}>Sign in</Heading>
          <Text color="secondary">You sign in with your organization account.</Text>
        </VStack>

        {error && <Banner status="error" title={error} />}

        <Button
          href="/api/auth/signin"
          variant="primary"
          width="100%"
          label="Continue with single sign-on"
        />
      </VStack>
    </Card>
  )
}
