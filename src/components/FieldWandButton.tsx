import { useState } from 'react'
import type { Character, Persona } from '../models/types'
import {
  expandCardField,
  FIELD_WAND_LABELS,
  type FieldWandExpansion,
} from '../services/fieldWandService'
import { listCharacters, listPersonas } from '../services/libraryRepository'

type Props = {
  fieldLabel: string
  value: string
  cardContext: string
  onApplied: (next: string) => void
}

export function FieldWandButton({ fieldLabel, value, cardContext, onApplied }: Props) {
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [xrefOpen, setXrefOpen] = useState(false)
  const [sources, setSources] = useState<{ id: string; label: string; block: string }[]>([])
  const [pendingExpansion, setPendingExpansion] = useState<FieldWandExpansion | null>(null)

  async function run(expansion: FieldWandExpansion, crossReferenceBlock?: string) {
    setBusy(true)
    setError(null)
    try {
      const next = await expandCardField({
        fieldLabel,
        currentValue: value,
        cardContext,
        expansion,
        crossReferenceBlock,
      })
      onApplied(next)
      setOpen(false)
      setXrefOpen(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setBusy(false)
    }
  }

  async function openCrossRef(expansion: FieldWandExpansion) {
    setPendingExpansion(expansion)
    const [chars, personas] = await Promise.all([listCharacters(), listPersonas()])
    const rows: { id: string; label: string; block: string }[] = [
      ...chars.map((c: Character) => ({
        id: `char:${c.id}`,
        label: `Character · ${c.name}`,
        block: [
          `Name: ${c.name}`,
          c.description,
          c.personality,
          c.scenario,
        ]
          .filter(Boolean)
          .join('\n'),
      })),
      ...personas.map((p: Persona) => ({
        id: `persona:${p.id}`,
        label: `Persona · ${p.name}`,
        block: [
          `Name: ${p.name}`,
          p.identity,
          p.appearance,
          p.personality,
          p.background,
        ]
          .filter(Boolean)
          .join('\n'),
      })),
    ]
    setSources(rows)
    setXrefOpen(true)
  }

  return (
    <>
      <button
        type="button"
        className="btn-ghost px-2 py-1 text-xs text-[color:var(--color-accent)]"
        title="AI field wand"
        onClick={() => setOpen(true)}
      >
        ✦
      </button>
      {open && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-3 sm:items-center"
          onClick={() => !busy && setOpen(false)}
        >
          <div
            className="glass-panel w-full max-w-sm rounded-t-2xl p-3 sm:rounded-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <p className="mb-2 font-heading text-base font-semibold">Field wand · {fieldLabel}</p>
            {(Object.keys(FIELD_WAND_LABELS) as FieldWandExpansion[]).map((key) => (
              <button
                key={key}
                type="button"
                className="mb-1 block w-full rounded-xl px-3 py-2.5 text-left hover:bg-white/5 disabled:opacity-40"
                disabled={busy}
                onClick={() => void run(key)}
              >
                <span className="block text-sm">{FIELD_WAND_LABELS[key].title}</span>
                <span className="block text-xs text-[color:var(--color-muted)]">
                  {FIELD_WAND_LABELS[key].subtitle}
                </span>
              </button>
            ))}
            <button
              type="button"
              className="mt-2 block w-full rounded-xl px-3 py-2.5 text-left text-sm text-[color:var(--color-accent)] hover:bg-white/5 disabled:opacity-40"
              disabled={busy}
              onClick={() => void openCrossRef('medium')}
            >
              Cross-reference another card…
            </button>
            {error && <p className="mt-2 text-sm text-[color:var(--color-error)]">{error}</p>}
            {busy && <p className="mt-2 text-xs text-[color:var(--color-muted)]">Writing…</p>}
          </div>
        </div>
      )}
      {xrefOpen && (
        <div
          className="fixed inset-0 z-[60] flex items-end justify-center bg-black/60 p-3 sm:items-center"
          onClick={() => !busy && setXrefOpen(false)}
        >
          <div
            className="glass-panel max-h-[70vh] w-full max-w-sm overflow-y-auto rounded-t-2xl p-3 sm:rounded-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <p className="mb-2 font-heading text-base font-semibold">Cross-reference source</p>
            {sources.length === 0 ? (
              <p className="text-sm text-[color:var(--color-muted)]">No other cards yet.</p>
            ) : (
              sources.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  className="mb-1 block w-full rounded-xl px-3 py-2.5 text-left text-sm hover:bg-white/5"
                  disabled={busy || !pendingExpansion}
                  onClick={() => pendingExpansion && void run(pendingExpansion, s.block)}
                >
                  {s.label}
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </>
  )
}
