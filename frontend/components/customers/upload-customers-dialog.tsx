'use client'

import { useState, useTransition } from 'react'
import { Banner } from '@astryxdesign/core/Banner'
import { Button } from '@astryxdesign/core/Button'
import { Code } from '@astryxdesign/core/Code'
import { Dialog, DialogHeader } from '@astryxdesign/core/Dialog'
import { FileInput } from '@astryxdesign/core/FileInput'
import { Layout, LayoutContent, LayoutFooter } from '@astryxdesign/core/Layout'
import { HStack, VStack } from '@astryxdesign/core/Stack'
import { Text } from '@astryxdesign/core/Text'
import { uploadCustomersAction } from '@/lib/features/customers/api'
import type { UploadState } from '@/lib/features/customers/types'

const HEADER = 'customer_code,name,address,address2,state,zipcode'

const MAX_DETAILS = 20

const count = (n: number) => `${n.toLocaleString()} ${n === 1 ? 'customer' : 'customers'}`

function UploadForm({ projectId, onClose }: { projectId: string; onClose: () => void }) {
  const [file, setFile] = useState<File | null>(null)
  const [result, setResult] = useState<UploadState>(null)
  const [pending, startUpload] = useTransition()

  function upload() {
    const formData = new FormData()
    if (file) formData.set('file', file)
    startUpload(async () => setResult(await uploadCustomersAction(projectId, formData)))
  }

  return (
    <Layout
      header={<DialogHeader title="Upload customers" onOpenChange={onClose} />}
      content={
        <LayoutContent>
          <VStack gap={4}>
            <VStack gap={1}>
              <Text color="secondary">
                Rows with an existing customer code update that customer. The first row must be this header:
              </Text>
              <Code>{HEADER}</Code>
            </VStack>
            <FileInput
              label="CSV file"
              accept=".csv,text/csv"
              mode="dropzone"
              value={file}
              onChange={(next) => {
                setFile(next instanceof File ? next : null)
                setResult(null)
              }}
              isLoading={pending}
              status={result?.ok === false ? { type: 'error' } : undefined}
            />
            {result?.ok && (
              <Banner
                status="success"
                title={`${count(result.created)} added, ${count(result.updated)} updated`}
                description="Map pins are still being looked up — new customers appear on the map as their addresses are found."
              />
            )}
            {result?.ok === false && (
              <Banner
                status="error"
                title={result.message}
                description={result.details.length ? 'Fix these rows in the file, then upload it again.' : undefined}
                collapsible={false}
              >
                {result.details.length > 0 && (
                  <VStack gap={1}>
                    {result.details.slice(0, MAX_DETAILS).map((line) => (
                      <Text key={line}>{line}</Text>
                    ))}
                    {result.details.length > MAX_DETAILS && (
                      <Text color="secondary">{`And ${result.details.length - MAX_DETAILS} more`}</Text>
                    )}
                  </VStack>
                )}
              </Banner>
            )}
          </VStack>
        </LayoutContent>
      }
      footer={
        <LayoutFooter>
          <HStack gap={2} hAlign="end">
            <Button label={result?.ok ? 'Done' : 'Cancel'} variant="secondary" onClick={onClose} />
            <Button
              variant="primary"
              label={pending ? 'Uploading…' : 'Upload CSV'}
              isLoading={pending}
              onClick={upload}
            />
          </HStack>
        </LayoutFooter>
      }
    />
  )
}

export function UploadCustomersButton({ projectId, variant }: { projectId: string; variant: 'primary' | 'secondary' }) {
  const [isOpen, setOpen] = useState(false)
  return (
    <>
      <Button variant={variant} label="Upload CSV" onClick={() => setOpen(true)} />
      <Dialog isOpen={isOpen} onOpenChange={setOpen} purpose="form" width={520}>
        {isOpen && <UploadForm projectId={projectId} onClose={() => setOpen(false)} />}
      </Dialog>
    </>
  )
}
