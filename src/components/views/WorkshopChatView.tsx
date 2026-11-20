import { useCallback, useEffect, useRef, useState } from 'react'
import { PageHeader } from '../layout/PageHeader'
import { newId } from '../../lib/ids'
import type { WorldWorkshop } from '../../models/types'
import { completeChat } from '../../services/nanogpt'
import { getApiKey, getChatModelId, getUseSubscription } from '../../services/settingsStore'
import { getSamplingSettings } from '../../services/generationSettings'
import {
  appendWorkshopMessage,
  getWorkshop,
  saveWorkshop,
} from '../../services/workshopRepository'
import { blankLorebook, upsertLorebook } from '../../services/libraryRepository'

type Props = {
  workshopId: string
  onBack: () => void
  onOpenApi: () => void
}

export function WorkshopChatView({ workshopId, onBack, onOpenApi }: Props) {
  const [workshop, setWorkshop] = useState<WorldWorkshop | null>(null)
  const [draft, setDraft] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const bottomRef = useRef<HTMLDivElement>(null)

  const reload = useCallback(async () => {
    setWorkshop((await getWorkshop(workshopId)) ?? null)
  }, [workshopId])

  useEffect(() => {
    void reload()
  }, [reload])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [workshop?.messages?.length, busy])

  async function send() {
    if (!workshop || busy) return
    const text = draft.trim()
    if (!text) return
    const apiKey = await getApiKey()
    const model = await getChatModelId()
    if (!apiKey || !model) {
      setError('Add API key and model under API & connection.')
      return
    }
    setBusy(true)
    setError(null)
    setDraft('')
    try {
      let next = await appendWorkshopMessage(workshop, {
        id: newId('wmsg'),
        role: 'user',
        text,
      })
      setWorkshop(next)
      const sampling = await getSamplingSettings()
      const history = (next.messages ?? []).map((m) => ({
        role: (m.role === 'assistant' ? 'assistant' : 'user') as 'assistant' | 'user',
        content: String(m.text ?? ''),
      }))
      const reply = await completeChat({
        apiKey,
        model,
        useSubscription: await getUseSubscription(),
        temperature: sampling.temperature,
        top_p: sampling.topP,
        max_tokens: Math.max(1536, sampling.maxTokens),
        messages: [
          {
            role: 'system',
            content:
              'You are a collaborative worldbuilding partner for a private fiction app called Anima. ' +
              'Help brainstorm setting, factions, tone, and hooks. Be concrete and inventive. ' +
              `Workshop title: ${next.name}.`,
          },
          ...history,
        ],
      })
      next = await appendWorkshopMessage(next, {
        id: newId('wmsg'),
        role: 'assistant',
        text: reply.trim(),
      })
      setWorkshop(next)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setBusy(false)
    }
  }

  async function saveSummaryAsLore() {
    if (!workshop) return
    const summary =
      workshop.worldSummary?.trim() ||
      (workshop.messages ?? [])
        .filter((m) => m.role === 'assistant')
        .map((m) => m.text)
        .join('\n\n')
        .slice(0, 4000)
    if (!summary.trim()) {
      setError('No workshop content to export yet.')
      return
    }
    const book = blankLorebook()
    book.name = `${workshop.name} lore`
    book.book = {
      ...book.book,
      name: book.name,
      entries: [
        {
          id: newId('entry'),
          keys: [workshop.name],
          content: summary,
          enabled: true,
          constant: true,
          comment: 'Exported from Creation Center',
        },
      ],
    }
    await upsertLorebook(book)
    const updated = { ...workshop, linkedLorebookId: book.id, worldSummary: summary }
    await saveWorkshop(updated)
    setWorkshop(updated)
  }

  if (!workshop) {
    return (
      <div className="mx-auto max-w-xl px-4 py-10 text-center text-[color:var(--color-muted)]">
        {error ?? 'Loading…'}
        <div className="mt-4">
          <button type="button" className="btn-ghost" onClick={onBack}>
            Back
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-dvh flex-col">
      <div className="mx-auto w-full max-w-xl px-4 pt-2">
        <PageHeader
          title={workshop.name}
          onBack={onBack}
          trailing={
            <button type="button" className="btn-ghost text-xs" onClick={onOpenApi}>
              API
            </button>
          }
        />
        <input
          className="field-input mb-2"
          value={workshop.name}
          onChange={(e) => {
            const name = e.target.value
            setWorkshop({ ...workshop, name })
            void saveWorkshop({ ...workshop, name })
          }}
        />
        <div className="mb-2 flex flex-wrap gap-2">
          <button type="button" className="btn-outline text-sm" disabled={busy} onClick={() => void saveSummaryAsLore()}>
            Export to lorebook
          </button>
        </div>
      </div>

      {error && (
        <div className="mx-4 mb-2 rounded-xl border border-[color:var(--color-error)]/35 bg-[color:var(--color-error)]/10 px-3 py-2 text-sm text-[color:var(--color-error)]">
          {error}
        </div>
      )}

      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-4 py-2">
        {(workshop.messages ?? []).map((m) => (
          <div
            key={m.id ?? m.text}
            className={`rounded-2xl px-3.5 py-2.5 text-sm ${
              m.role === 'user'
                ? 'ml-8 bg-[color:var(--color-accent-deep)]/80'
                : 'mr-8 glass-panel'
            }`}
          >
            {m.text}
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      <div className="flex gap-2 border-t border-[color:var(--color-glass-border)] px-4 py-3">
        <textarea
          className="field-input min-h-[2.75rem] flex-1 resize-none"
          rows={2}
          placeholder="Describe the world, ask for factions, tone…"
          value={draft}
          disabled={busy}
          onChange={(e) => setDraft(e.target.value)}
        />
        <button type="button" className="btn-primary self-end" disabled={busy} onClick={() => void send()}>
          {busy ? '…' : 'Send'}
        </button>
      </div>
    </div>
  )
}
