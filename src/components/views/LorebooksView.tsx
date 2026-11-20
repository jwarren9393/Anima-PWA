import { useCallback, useEffect, useRef, useState } from 'react'
import type { GlobalLorebook, LorebookEntry } from '../../models/types'
import { newId } from '../../lib/ids'
import { downloadTextFile } from '../../services/characterCardCodec'
import { parseLorebookImport } from '../../services/lorebookService'
import {
  blankLorebook,
  deleteLorebook,
  listLorebooks,
  upsertLorebook,
} from '../../services/libraryRepository'
import {
  getLoreScanSettings,
  setLoreScanSettings,
  type LoreScanSettings,
} from '../../services/generationSettings'

function entriesArray(book: GlobalLorebook): LorebookEntry[] {
  const raw = book.book.entries
  if (!raw) return []
  if (Array.isArray(raw)) return raw
  return Object.entries(raw).map(([id, entry]) => ({ ...entry, id: entry.id ?? id }))
}

export function LorebooksView() {
  const [items, setItems] = useState<GlobalLorebook[]>([])
  const [editing, setEditing] = useState<GlobalLorebook | null>(null)
  const [scan, setScan] = useState<LoreScanSettings>({
    scanDepth: 4,
    tokenBudget: 512,
    recursive: false,
  })
  const [error, setError] = useState<string | null>(null)
  const [status, setStatus] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const reload = useCallback(async () => {
    setItems(await listLorebooks())
    setScan(await getLoreScanSettings())
  }, [])

  useEffect(() => {
    void reload()
  }, [reload])

  async function handleImport(file: File) {
    setError(null)
    try {
      const book = parseLorebookImport(JSON.parse(await file.text()))
      await upsertLorebook(book)
      setEditing(book)
      setStatus(`Imported “${book.name}”.`)
      await reload()
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  async function handleSave() {
    if (!editing) return
    const name = editing.name.trim() || 'Lorebook'
    const next = {
      ...editing,
      name,
      book: { ...editing.book, name, entries: entriesArray(editing) },
    }
    await upsertLorebook(next)
    setEditing(next)
    setStatus('Lorebook saved.')
    await reload()
  }

  function updateEntry(index: number, patch: Partial<LorebookEntry>) {
    if (!editing) return
    const list = entriesArray(editing).map((e, i) => (i === index ? { ...e, ...patch } : e))
    setEditing({
      ...editing,
      book: { ...editing.book, entries: list },
    })
  }

  function addEntry() {
    if (!editing) return
    const list = [
      ...entriesArray(editing),
      {
        id: newId('entry'),
        keys: [],
        content: '',
        comment: 'New entry',
        enabled: true,
        constant: false,
        position: 'before_char',
        priority: 10,
      } satisfies LorebookEntry,
    ]
    setEditing({ ...editing, book: { ...editing.book, entries: list } })
  }

  return (
    <div className="flex w-full flex-col gap-5">
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          className="btn-primary"
          onClick={() => {
            setEditing(blankLorebook())
            setError(null)
          }}
        >
          + New
        </button>
        <button type="button" className="btn-outline" onClick={() => fileRef.current?.click()}>
          Import ST JSON
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

      <section className="glass-panel grid gap-3 rounded-2xl p-4 sm:grid-cols-3">
        <label className="text-sm text-white/65">
          Scan depth
          <input
            className="field-input mt-1"
            type="number"
            min={1}
            value={scan.scanDepth}
            onChange={(e) => setScan({ ...scan, scanDepth: Number(e.target.value) || 1 })}
          />
        </label>
        <label className="text-sm text-white/65">
          Token budget
          <input
            className="field-input mt-1"
            type="number"
            min={64}
            value={scan.tokenBudget}
            onChange={(e) => setScan({ ...scan, tokenBudget: Number(e.target.value) || 64 })}
          />
        </label>
        <label className="flex items-end gap-2 pb-2 text-sm text-white/65">
          <input
            type="checkbox"
            checked={scan.recursive}
            onChange={(e) => setScan({ ...scan, recursive: e.target.checked })}
          />
          Recursive scan
        </label>
        <button
          type="button"
          className="btn-ghost sm:col-span-3 sm:w-fit"
          onClick={async () => {
            await setLoreScanSettings(scan)
            setStatus('Lore scan settings saved.')
          }}
        >
          Save scan settings
        </button>
      </section>

      {error && <p className="text-sm text-rose-300/90">{error}</p>}
      {status && <p className="text-sm text-emerald-300/90">{status}</p>}

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)]">
        <section className="glass-panel max-h-[60vh] space-y-2 overflow-y-auto rounded-2xl p-3">
          {items.length === 0 && (
            <p className="px-2 py-8 text-center text-sm text-white/45">No lorebooks yet.</p>
          )}
          {items.map((b) => (
            <button
              key={b.id}
              type="button"
              className={`flex w-full items-center justify-between rounded-xl px-3 py-2 text-left ${
                editing?.id === b.id ? 'bg-gold-500/15' : 'hover:bg-white/5'
              }`}
              onClick={() => setEditing({ ...b, book: { ...b.book } })}
            >
              <span className="font-medium">{b.name}</span>
              <span className="text-xs text-white/40">{b.enabled ? 'on' : 'off'}</span>
            </button>
          ))}
        </section>

        {editing && (
          <section className="glass-panel max-h-[70vh] space-y-3 overflow-y-auto rounded-2xl p-4">
            <label className="block text-sm text-white/65">
              Name
              <input
                className="field-input mt-1"
                value={editing.name}
                onChange={(e) => setEditing({ ...editing, name: e.target.value })}
              />
            </label>
            <label className="flex items-center gap-2 text-sm text-white/65">
              <input
                type="checkbox"
                checked={editing.enabled}
                onChange={(e) => setEditing({ ...editing, enabled: e.target.checked })}
              />
              Enabled globally
            </label>

            <div className="flex items-center justify-between pt-2">
              <h3 className="text-sm font-medium text-white/80">Entries</h3>
              <button type="button" className="btn-ghost px-2 py-1 text-xs" onClick={addEntry}>
                Add entry
              </button>
            </div>

            {entriesArray(editing).map((entry, index) => (
              <div key={String(entry.id ?? index)} className="space-y-2 rounded-xl border border-white/10 p-3">
                <input
                  className="field-input"
                  placeholder="Label"
                  value={String(entry.comment ?? '')}
                  onChange={(e) => updateEntry(index, { comment: e.target.value })}
                />
                <input
                  className="field-input"
                  placeholder="Keywords (comma-separated)"
                  value={(entry.keys ?? []).join(', ')}
                  onChange={(e) =>
                    updateEntry(index, {
                      keys: e.target.value
                        .split(',')
                        .map((s) => s.trim())
                        .filter(Boolean),
                    })
                  }
                />
                <textarea
                  className="field-input min-h-[4rem]"
                  placeholder="Content"
                  value={String(entry.content ?? '')}
                  onChange={(e) => updateEntry(index, { content: e.target.value })}
                />
                <div className="flex flex-wrap gap-3 text-xs text-white/55">
                  <label className="flex items-center gap-1">
                    <input
                      type="checkbox"
                      checked={entry.constant === true}
                      onChange={(e) => updateEntry(index, { constant: e.target.checked })}
                    />
                    Constant
                  </label>
                  <select
                    className="field-input py-1"
                    value={String(entry.position ?? 'before_char')}
                    onChange={(e) => updateEntry(index, { position: e.target.value })}
                  >
                    <option value="before_char">Before character</option>
                    <option value="after_char">After character</option>
                  </select>
                  <button
                    type="button"
                    className="text-rose-300"
                    onClick={() => {
                      const list = entriesArray(editing).filter((_, i) => i !== index)
                      setEditing({
                        ...editing,
                        book: { ...editing.book, entries: list },
                      })
                    }}
                  >
                    Remove
                  </button>
                </div>
              </div>
            ))}

            <div className="flex flex-wrap gap-2 pt-2">
              <button type="button" className="btn-primary" onClick={() => void handleSave()}>
                Save
              </button>
              <button
                type="button"
                className="btn-ghost"
                onClick={() =>
                  downloadTextFile(
                    `${editing.name || 'lorebook'}.json`,
                    JSON.stringify(editing.book, null, 2),
                  )
                }
              >
                Export JSON
              </button>
              <button
                type="button"
                className="btn-ghost text-rose-300"
                onClick={async () => {
                  await deleteLorebook(editing.id)
                  setEditing(null)
                  await reload()
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
