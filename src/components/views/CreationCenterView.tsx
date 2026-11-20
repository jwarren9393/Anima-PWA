import { useCallback, useEffect, useState } from 'react'
import { PageHeader } from '../layout/PageHeader'
import type { WorldWorkshop } from '../../models/types'
import {
  createWorkshop,
  deleteWorkshop,
  listWorkshops,
} from '../../services/workshopRepository'

type Props = {
  refreshKey?: number
  onBack: () => void
  onOpenWorkshop: (id: string) => void
}

export function CreationCenterView({ refreshKey, onBack, onOpenWorkshop }: Props) {
  const [items, setItems] = useState<WorldWorkshop[]>([])
  const [error, setError] = useState<string | null>(null)

  const reload = useCallback(async () => {
    setItems(await listWorkshops())
  }, [])

  useEffect(() => {
    void reload()
  }, [reload, refreshKey])

  return (
    <div className="mx-auto w-full max-w-xl px-4 pb-28 pt-2">
      <PageHeader title="Creation Center" onBack={onBack} />
      <p className="mb-4 text-sm text-[color:var(--color-muted)]">
        Brainstorm worlds with the AI, then keep a summary for lore or chats.
      </p>
      {error && <p className="mb-3 text-sm text-[color:var(--color-error)]">{error}</p>}

      {items.length === 0 ? (
        <div className="py-16 text-center text-[color:var(--color-muted)]">
          <p className="font-heading text-lg text-[color:var(--color-ink)]">No workshops yet</p>
          <p className="mt-2 text-sm">Start a world workshop to draft setting ideas.</p>
        </div>
      ) : (
        <ul className="divide-y divide-white/5">
          {items.map((w) => (
            <li key={w.id}>
              <button
                type="button"
                className="flex w-full items-start gap-3 py-3.5 text-left hover:bg-white/[0.03]"
                onClick={() => onOpenWorkshop(w.id)}
                onContextMenu={(e) => {
                  e.preventDefault()
                  if (confirm(`Delete workshop “${w.name}”?`)) {
                    void deleteWorkshop(w.id)
                      .then(reload)
                      .catch((err) => setError(err instanceof Error ? err.message : String(err)))
                  }
                }}
              >
                <div className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[color:var(--color-surface-high)] text-[color:var(--color-accent)]">
                  ✦
                </div>
                <div className="min-w-0 flex-1">
                  <div className="truncate font-semibold">{w.name}</div>
                  <div className="truncate text-sm text-[color:var(--color-muted)]">
                    {(w.worldSummary || w.messages?.slice(-1)[0]?.text || 'Empty workshop').slice(
                      0,
                      90,
                    )}
                  </div>
                </div>
              </button>
            </li>
          ))}
        </ul>
      )}

      <button
        type="button"
        className="btn-primary fixed bottom-6 right-5 z-20 shadow-lg shadow-black/40"
        onClick={() => {
          void createWorkshop()
            .then((w) => onOpenWorkshop(w.id))
            .catch((err) => setError(err instanceof Error ? err.message : String(err)))
        }}
      >
        + New workshop
      </button>
    </div>
  )
}
