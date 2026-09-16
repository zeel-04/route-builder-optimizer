'use client'

import { useActionState, useState } from 'react'
import { Banner } from '@astryxdesign/core/Banner'
import { Button } from '@astryxdesign/core/Button'
import { Card } from '@astryxdesign/core/Card'
import { FormLayout } from '@astryxdesign/core/FormLayout'
import { Heading } from '@astryxdesign/core/Heading'
import { VStack } from '@astryxdesign/core/Stack'
import { Text } from '@astryxdesign/core/Text'
import { TextInput } from '@astryxdesign/core/TextInput'
import { loginAction } from '@/lib/features/auth/api'

export function LoginForm() {
  const [state, formAction, pending] = useActionState(loginAction, null)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')

  const fieldStatus = (field: 'email' | 'password') => {
    const message = state?.errors?.[field]?.[0]
    return message ? { type: 'error' as const, message } : undefined
  }

  return (
    <Card width="100%" maxWidth={400}>
      <form action={formAction}>
        <VStack gap={6}>
          <VStack gap={1}>
            <Heading level={1}>Sign in</Heading>
            <Text color="secondary">Use the email and password your administrator gave you.</Text>
          </VStack>

          {state?.message && <Banner status="error" title={state.message} />}

          <FormLayout>
            <TextInput
              label="Email"
              type="email"
              htmlName="email"
              autoComplete="email"
              value={email}
              onChange={setEmail}
              status={fieldStatus('email')}
              hasAutoFocus
            />
            <TextInput
              label="Password"
              type="password"
              htmlName="password"
              autoComplete="current-password"
              value={password}
              onChange={setPassword}
              status={fieldStatus('password')}
            />
          </FormLayout>

          <Button
            type="submit"
            variant="primary"
            width="100%"
            label={pending ? 'Signing in…' : 'Sign in'}
            isLoading={pending}
          />
        </VStack>
      </form>
    </Card>
  )
}
