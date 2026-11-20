import { useCallback, useEffect, useRef, useState } from 'react'
import type { Persona } from '../../models/types'
import { downloadTextFile } from '../../services/characterCardCodec'
import {
  parsePersonaCardText,
  personaToJson,
} from '../../services/personaCardCodec'
import { FieldWandButton } from '../FieldWandButton'
import {
  blankPersona,
  deletePersona,
  getActivePersonaId,
  listPersonas,
  setActivePersonaId,
  upsertPersona,
} from '../../services/libraryRepository'

type Props = {
  onChanged?: () => void
}

export function PersonasView({ onChanged }: Props) {
  const [items, setItems] = useState<Persona[]>([])
  const [activeId, setActiveId] = useState<string | null>(null)
  const [editing, setEditing] = useState<Persona | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [status, setStatus] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const reload = useCallback(async () => {
    setItems(await listPersonas())
    setActiveId(await getActivePersonaId())
  }, [])

  useEffect(() => {
    void reload()
  }, [reload])

  async function handleImport(file: File) {
    setError(null)
    try {
      const persona = parsePersonaCardText(await file.text())
      await upsertPersona(persona)
      setEditing(persona)
      setStatus(`Imported “${persona.name}”.`)
      await reload()
      onChanged?.()
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  async function handleSave() {
    if (!editing) return
    if (!editing.name.trim()) {
      setError('Name is required.')
      return
    }
    setError(null)
    await upsertPersona({ ...editing, name: editing.name.trim() })
    setStatus('Persona saved.')
    await reload()
    onChanged?.()
  }

  function cardContext(): string {
    if (!editing) return ''
    return [
      `Name: ${editing.name}`,
      editing.identity,
      editing.appearance,
      editing.personality,
      editing.background,
      editing.goals,
    ]
      .filter(Boolean)
      .join('\n')
  }

  function field(label: string, key: keyof Persona, multiline = false) {
    if (!editing) return null
    const value = String(editing[key] ?? '')
    return (
      <label className="block text-sm text-white/65">
        <span className="flex items-center justify-between gap-2">
          {label}
          {multiline && (
            <FieldWandButton
              fieldLabel={label}
              value={value}
              cardContext={cardContext()}
              onApplied={(next) => setEditing({ ...editing, [key]: next })}
            />
          )}
        </span>
        {multiline ? (
          <textarea
            className="field-input mt-1 min-h-[4.5rem]"
            value={value}
            onChange={(e) => setEditing({ ...editing, [key]: e.target.value })}
          />
        ) : (
          <input
            className="field-input mt-1"
            value={value}
            onChange={(e) => setEditing({ ...editing, [key]: e.target.value })}
          />
        )}
      </label>
    )
  }

  return (
    <div className="flex w-full flex-col gap-5">
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          className="btn-primary"
          onClick={() => {
            setEditing(blankPersona())
            setError(null)
            setStatus(null)
          }}
        >
          + New
        </button>
        <button type="button" className="btn-outline" onClick={() => fileRef.current?.click()}>
          Import JSON
        </button>
        <input
          ref={fileRef}
          type="file"
          accept=".json,application/json"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0]
            if (f) void handleImport(f)
          }}
        />
      </div>

      {error && <p className="text-sm text-rose-300/90">{error}</p>}
      {status && <p className="text-sm text-emerald-300/90">{status}</p>}

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
        <section className="glass-panel max-h-[70vh] space-y-2 overflow-y-auto rounded-2xl p-3">
          {items.length === 0 && (
            <p className="px-2 py-8 text-center text-sm text-white/45">No personas yet.</p>
          )}
          {items.map((p) => (
            <button
              key={p.id}
              type="button"
              className={`flex w-full items-center justify-between rounded-xl px-3 py-2 text-left ${
                editing?.id === p.id ? 'bg-gold-500/15' : 'hover:bg-white/5'
              }`}
              onClick={() => setEditing({ ...p })}
            >
              <span>
                <span className="font-medium">{p.name}</span>
                {activeId === p.id && (
                  <span className="ml-2 text-xs text-gold-400">default</span>
                )}
              </span>
            </button>
          ))}
        </section>

        {editing && (
          <section className="glass-panel space-y-3 rounded-2xl p-4">
            <h2 className="font-medium">Edit persona</h2>
            {field('Name', 'name')}
            {field('Identity / role', 'identity', true)}
            {field('Appearance', 'appearance', true)}
            {field('Personality', 'personality', true)}
            {field('Background', 'background', true)}
            {field('Goals', 'goals', true)}
            {field('Custom prompt block (optional)', 'promptText', true)}
            <div className="flex flex-wrap gap-2 pt-2">
              <button type="button" className="btn-primary" onClick={() => void handleSave()}>
                Save
              </button>
              <button
                type="button"
                className="btn-ghost"
                onClick={async () => {
                  await setActivePersonaId(editing.id)
                  setActiveId(editing.id)
                  setStatus('Default persona updated.')
                  onChanged?.()
                }}
              >
                Set default
              </button>
              <button
                type="button"
                className="btn-ghost"
                onClick={() =>
                  downloadTextFile(`${editing.name || 'persona'}.json`, personaToJson(editing))
                }
              >
                Export JSON
              </button>
              <button
                type="button"
                className="btn-ghost text-rose-300"
                onClick={async () => {
                  await deletePersona(editing.id)
                  setEditing(null)
                  await reload()
                  onChanged?.()
                }}
              >
                Delete
              </button>
            </div>
          </section>
        )}
      </div>
    </div>
  )
}
