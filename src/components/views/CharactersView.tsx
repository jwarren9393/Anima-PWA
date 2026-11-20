import { useCallback, useEffect, useRef, useState } from 'react'
import type { Character } from '../../models/types'
import {
  characterToStV2Json,
  downloadBytesFile,
  downloadTextFile,
  exportCharacterPng,
  parseCharacterCardText,
  parseCharacterFromPng,
} from '../../services/characterCardCodec'
import {
  blankCharacter,
  deleteCharacter,
  listCharacters,
  upsertCharacter,
} from '../../services/libraryRepository'
import { FieldWandButton } from '../FieldWandButton'
import { getDb } from '../../db/database'

type Props = {
  onStartChat: (characterId: string) => void
}

export function CharactersView({ onStartChat }: Props) {
  const [items, setItems] = useState<Character[]>([])
  const [editing, setEditing] = useState<Character | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [status, setStatus] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const reload = useCallback(async () => {
    setItems(await listCharacters())
  }, [])

  useEffect(() => {
    void reload()
  }, [reload])

  async function handleImport(file: File) {
    setError(null)
    setStatus(null)
    try {
      const buf = new Uint8Array(await file.arrayBuffer())
      let character: Character
      if (file.name.toLowerCase().endsWith('.png') || file.type === 'image/png') {
        character = parseCharacterFromPng(buf)
        // Store PNG as avatar media
        const fileName = `${character.id}.png`
        const copy = new Uint8Array(buf.byteLength)
        copy.set(buf)
        await getDb().media.put({
          id: `avatar:${fileName}`,
          fileName,
          kind: 'avatar',
          mimeType: 'image/png',
          data: copy.buffer,
          byteLength: copy.byteLength,
          updatedAt: new Date().toISOString(),
        })
        character.avatarFileName = fileName
      } else {
        character = parseCharacterCardText(new TextDecoder().decode(buf))
      }
      await upsertCharacter(character)
      setStatus(`Imported “${character.name}”.`)
      setEditing(character)
      await reload()
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
    await upsertCharacter({ ...editing, name: editing.name.trim() })
    setStatus('Character saved.')
    await reload()
  }

  async function handleDelete(id: string) {
    await deleteCharacter(id)
    if (editing?.id === id) setEditing(null)
    await reload()
  }

  async function handleExportJson(c: Character) {
    downloadTextFile(`${c.name || 'character'}.json`, characterToStV2Json(c))
  }

  async function handleExportPng(c: Character) {
    let avatar: Uint8Array | null = null
    if (c.avatarFileName) {
      const media = await getDb().media.get(`avatar:${c.avatarFileName}`)
      if (media) avatar = new Uint8Array(media.data)
    }
    const bytes = exportCharacterPng(c, avatar)
    downloadBytesFile(`${c.name || 'character'}.png`, bytes, 'image/png')
  }

  function cardContext(): string {
    if (!editing) return ''
    return [
      `Name: ${editing.name}`,
      editing.description,
      editing.personality,
      editing.scenario,
      editing.system_prompt,
    ]
      .filter(Boolean)
      .join('\n')
  }

  function field(
    label: string,
    key: keyof Character,
    multiline = false,
  ) {
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
            className="field-input mt-1 min-h-[5.5rem]"
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
            setEditing(blankCharacter())
            setError(null)
            setStatus(null)
          }}
        >
          + New
        </button>
        <button type="button" className="btn-outline" onClick={() => fileRef.current?.click()}>
          Import JSON/PNG
        </button>
        <input
          ref={fileRef}
          type="file"
          accept=".json,.png,application/json,image/png"
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
            <p className="px-2 py-8 text-center text-sm text-white/45">
              No characters yet. Import a SillyTavern card or create one.
            </p>
          )}
          {items.map((c) => (
            <div
              key={c.id}
              className={`flex items-center gap-2 rounded-xl px-3 py-2 ${
                editing?.id === c.id ? 'bg-gold-500/15' : 'hover:bg-white/5'
              }`}
            >
              <button
                type="button"
                className="min-w-0 flex-1 text-left"
                onClick={() => setEditing({ ...c })}
              >
                <div className="truncate font-medium">{c.name}</div>
                <div className="truncate text-xs text-white/40">
                  {c.description?.slice(0, 80) || 'No description'}
                </div>
              </button>
              <button
                type="button"
                className="btn-ghost shrink-0 px-2 py-1 text-xs"
                onClick={() => onStartChat(c.id)}
              >
                Chat
              </button>
            </div>
          ))}
        </section>

        {editing && (
          <section className="glass-panel space-y-3 rounded-2xl p-4">
            <h2 className="font-medium text-white/90">Edit character</h2>
            {field('Name', 'name')}
            {field('Description', 'description', true)}
            {field('Personality', 'personality', true)}
            {field('Scenario', 'scenario', true)}
            {field('First message', 'first_mes', true)}
            {field('Example dialogue', 'mes_example', true)}
            {field('System prompt', 'system_prompt', true)}
            {field('Post-history instructions', 'post_history_instructions', true)}
            {field('Creator notes', 'creator_notes', true)}

            <div className="flex flex-wrap gap-2 pt-2">
              <button type="button" className="btn-primary" onClick={() => void handleSave()}>
                Save
              </button>
              <button
                type="button"
                className="btn-ghost"
                onClick={() => void handleExportJson(editing)}
              >
                Export JSON
              </button>
              <button
                type="button"
                className="btn-ghost"
                onClick={() => void handleExportPng(editing)}
              >
                Export PNG
              </button>
              <button
                type="button"
                className="btn-ghost text-rose-300"
                onClick={() => void handleDelete(editing.id)}
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
