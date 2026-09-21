'use client'

import { useState, useTransition } from 'react'
import { Banner } from '@astryxdesign/core/Banner'
import { Button } from '@astryxdesign/core/Button'
import { Card } from '@astryxdesign/core/Card'
import { Dialog, DialogHeader } from '@astryxdesign/core/Dialog'
import { FileInput } from '@astryxdesign/core/FileInput'
import { Layout, LayoutContent, LayoutFooter } from '@astryxdesign/core/Layout'
import { HStack, VStack } from '@astryxdesign/core/Stack'
import { Text } from '@astryxdesign/core/Text'
import { useToast } from '@astryxdesign/core/Toast'
import { uploadCustomersAction } from '@/lib/features/customers/api'
import type { UploadState } from '@/lib/features/customers/types'

const HEADER = 'customer_code,name,address,address2,state,zipcode'

// The street lookup misses when a suite or unit is left in `address`, and the
// pin falls back to the ZIP code — so the prompt moves it to address2.
const CONVERT_PROMPT = `Convert my attached customer list to a CSV file with exactly this header: ${HEADER}
Put only the street number and street name in address; move any suite, unit, apt, #, floor or building into address2. Use the 2-letter state code and a 5-digit ZIP code, keeping leading zeros. Keep every row and leave missing values blank instead of guessing.`

const MAX_DETAILS = 20

const count = (n: number) => `${n.toLocaleString()} ${n === 1 ? 'customer' : 'customers'}`

function UploadForm({ projectId, onClose }: { projectId: string; onClose: () => void }) {
  const [file, setFile] = useState<File | null>(null)
  const [result, setResult] = useState<UploadState>(null)
  const [pending, startUpload] = useTransition()
  const toast = useToast()

  async function copyPrompt() {
    await navigator.clipboard.writeText(CONVERT_PROMPT)
    toast({ body: 'Prompt copied', uniqueID: 'convert-prompt' })
  }

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
                Rows with an existing customer code update that customer. To convert a spreadsheet, attach it in ChatGPT or Claude with this prompt:
              </Text>
              <Card variant="muted" padding={3}>
                <VStack gap={2} hAlign="start">
                  <Text style={{ whiteSpace: 'pre-line' }}>{CONVERT_PROMPT}</Text>
                  <Button label="Copy prompt" variant="secondary" size="sm" onClick={copyPrompt} />
                </VStack>
              </Card>
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
