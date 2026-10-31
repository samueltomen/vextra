import { Button, Tab, Tabs } from '@heroui/react'
import { Check, Clipboard } from 'lucide-react'
import { useEffect, useState } from 'react'

import type { IntegrationSnippet } from '../features/monitoring/model/integration-snippets.ts'

const COPIED_RESET_MS = 2_500

export function CodeTabs({
  snippets,
}: Readonly<{ snippets: readonly IntegrationSnippet[] }>) {
  const [selectedId, setSelectedId] = useState<string>(snippets[0]?.id ?? '')
  const [copied, setCopied] = useState(false)
  const selected =
    snippets.find((snippet) => snippet.id === selectedId) ?? snippets[0]

  useEffect(() => {
    if (!copied) {
      return undefined
    }

    const timeout = window.setTimeout(() => setCopied(false), COPIED_RESET_MS)

    return () => window.clearTimeout(timeout)
  }, [copied])

  if (!selected) {
    return null
  }

  async function copySnippet() {
    if (!selected) {
      return
    }

    await navigator.clipboard.writeText(selected.code)
    setCopied(true)
  }

  return (
    <div className="min-w-0">
      <Tabs
        aria-label="Langage d’intégration"
        classNames={{
          cursor: 'bg-action',
          tab: 'h-10 px-3',
          tabContent: 'text-muted group-data-[selected=true]:text-action',
          base: 'max-w-full',
          tabList: 'max-w-full gap-1 overflow-x-auto border-b border-line p-0',
        }}
        onSelectionChange={(key) => {
          setSelectedId(String(key))
          setCopied(false)
        }}
        selectedKey={selected.id}
        variant="underlined"
      >
        {snippets.map((snippet) => (
          <Tab key={snippet.id} title={snippet.label} />
        ))}
      </Tabs>

      <p className="mt-3 text-sm text-muted">{selected.hint}</p>
      <pre className="mt-3 overflow-x-auto rounded-lg border border-line bg-canvas p-4 font-mono text-[13px] leading-6 text-ink">
        <code>{selected.code}</code>
      </pre>
      <Button
        className="mt-4 min-h-11 bg-action font-semibold text-action-fg"
        onPress={() => void copySnippet()}
        radius="md"
        startContent={
          copied ? (
            <Check aria-hidden="true" size={17} />
          ) : (
            <Clipboard aria-hidden="true" size={17} />
          )
        }
      >
        {copied ? 'Commande copiée' : 'Copier la commande'}
      </Button>
    </div>
  )
}
