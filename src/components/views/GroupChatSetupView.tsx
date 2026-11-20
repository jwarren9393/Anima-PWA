import { useCallback, useEffect, useMemo, useState } from 'react'
import { PageHeader } from '../layout/PageHeader'
import type { Character, ChatSession, GlobalLorebook, Persona } from '../../models/types'
import {
  createGroupChat,
  getChat,
  saveChat,
  updateSessionCast,
} from '../../services/chatRepository'
import {
  getCharacter,
  getPersona,
  listCharacters,
  listLorebooks,
  listPersonas,
} from '../../services/libraryRepository'

type Props = {
  /** When set, edit existing cast instead of starting new. */
  chatId?: string
  onBack: () => void
  onStarted: (chatId: string) => void
  onSaved?: (session: ChatSession) => void
}

export function GroupChatSetupView({ chatId, onBack, onStarted, onSaved }: Props) {
  const isEdit = Boolean(chatId)
  const [all, setAll] = useState<Character[]>([])
  const [personas, setPersonas] = useState<Persona[]>([])
  const [lorebooks, setLorebooks] = useState<GlobalLorebook[]>([])
  const [ordered, setOrdered] = useState<Character[]>([])
  const [selectedLoreIds, setSelectedLoreIds] = useState<string[]>([])
  const [personaId, setPersonaId] = useState<string>('')
  const [title, setTitle] = useState('')
  const [authorsNote, setAuthorsNote] = useState('')
  const [autoReply, setAutoReply] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [existing, setExisting] = useState<ChatSession | null>(null)

  const reload = useCallback(async () => {
    setAll(await listCharacters())
    setPersonas(await listPersonas())
    setLorebooks(await listLorebooks())
    if (!chatId) return
    const session = await getChat(chatId)
    if (!session) {
      setError('Chat not found.')
      return
    }
    setExisting(session)
    setTitle(session.title ?? '')
    setAuthorsNote(session.authorsNote ?? '')
    setAutoReply(session.autoReply === true)
    setPersonaId(session.personaId ?? '')
    setSelectedLoreIds(session.lorebookIds ?? [])
    const ids =
      session.participantIds?.length
        ? session.participantIds
        : session.characterId
          ? [session.characterId]
          : []
    const members: Character[] = []
    for (const id of ids) {
      const c = await getCharacter(id)
      if (c) members.push(c)
    }
    setOrdered(members)
  }, [chatId])

  useEffect(() => {
    void reload()
  }, [reload])

  const selectedIds = useMemo(() => new Set(ordered.map((c) => c.id)), [ordered])

  function toggleMember(c: Character) {
    setError(null)
    if (selectedIds.has(c.id)) {
      setOrdered((prev) => prev.filter((x) => x.id !== c.id))
      return
    }
    setOrdered((prev) => [...prev, c])
  }

  function move(index: number, dir: -1 | 1) {
    setOrdered((prev) => {
      const next = [...prev]
      const j = index + dir
      if (j < 0 || j >= next.length) return prev
      ;[next[index], next[j]] = [next[j]!, next[index]!]
      return next
    })
  }

  async function handleSubmit() {
    if (isEdit ? ordered.length < 1 : ordered.length < 2) {
      setError(isEdit ? 'Pick at least one character.' : 'Pick at least two characters.')
      return
    }
    setBusy(true)
    setError(null)
    try {
      const persona = personaId ? (await getPersona(personaId)) ?? null : null
      if (isEdit && existing) {
        let updated = await updateSessionCast(existing, ordered, {
          authorsNote,
          autoReply,
          lorebookIds: selectedLoreIds.length ? selectedLoreIds : null,
          title: title.trim() || undefined,
        })
        updated = {
          ...updated,
          personaId: persona?.id ?? null,
        }
        await saveChat(updated)
        onSaved?.(updated)
        onBack()
        return
      }
      const session = await createGroupChat({
        members: ordered,
        persona,
        authorsNote,
        autoReply,
        lorebookIds: selectedLoreIds.length ? selectedLoreIds : null,
        title: title.trim() || undefined,
      })
      onStarted(session.id)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="mx-auto w-full max-w-xl px-4 pb-10 pt-2">
      <PageHeader title={isEdit ? 'Manage cast' : 'New group chat'} onBack={onBack} />

      {error && <p className="mb-3 text-sm text-[color:var(--color-error)]">{error}</p>}

      <label className="mb-3 block text-sm text-[color:var(--color-muted)]">
        Title
        <input
          className="field-input mt-1"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Group chat (N)"
        />
      </label>

      <div className="mb-3 flex flex-wrap gap-2">
        <label className="chip flex items-center gap-2">
          <input
            type="checkbox"
            checked={autoReply}
            onChange={(e) => setAutoReply(e.target.checked)}
          />
          Auto-reply
        </label>
        <span className="chip">
          Lore ({selectedLoreIds.length})
        </span>
        {authorsNote.trim() ? <span className="chip chip-selected">Note</span> : null}
      </div>

      {personas.length > 0 && (
        <label className="mb-3 block text-sm text-[color:var(--color-muted)]">
          Persona
          <select
            className="field-input mt-1"
            value={personaId}
            onChange={(e) => setPersonaId(e.target.value)}
          >
            <option value="">No persona</option>
            {personas.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </label>
      )}

      <label className="mb-4 block text-sm text-[color:var(--color-muted)]">
        Author&apos;s Note
        <textarea
          className="field-input mt-1 min-h-[4rem]"
          value={authorsNote}
          onChange={(e) => setAuthorsNote(e.target.value)}
          placeholder="Optional scene guidance…"
        />
      </label>

      {lorebooks.length > 0 && (
        <div className="mb-4">
          <p className="mb-2 text-sm text-[color:var(--color-muted)]">Lorebooks</p>
          <ul className="space-y-1">
            {lorebooks.map((b) => {
              const on = selectedLoreIds.includes(b.id)
              return (
                <li key={b.id}>
                  <button
                    type="button"
                    className={`w-full rounded-xl px-3 py-2 text-left text-sm ${
                      on ? 'bg-[color:var(--color-accent)]/15 text-[color:var(--color-accent)]' : 'hover:bg-white/5'
                    }`}
                    onClick={() =>
                      setSelectedLoreIds((prev) =>
                        on ? prev.filter((id) => id !== b.id) : [...prev, b.id],
                      )
                    }
                  >
                    {on ? '✓ ' : ''}
                    {b.name}
                  </button>
                </li>
              )
            })}
          </ul>
        </div>
      )}

      {ordered.length >= 2 && (
        <div className="mb-4">
          <p className="mb-2 text-sm font-medium text-[color:var(--color-accent)]">Reply order</p>
          <ul className="space-y-1">
            {ordered.map((c, i) => (
              <li
                key={c.id}
                className="flex items-center gap-2 rounded-xl border border-white/5 px-3 py-2"
              >
                <span className="min-w-0 flex-1 truncate">{c.name}</span>
                <button type="button" className="btn-ghost px-2 py-1 text-xs" disabled={i === 0} onClick={() => move(i, -1)}>
                  ↑
                </button>
                <button
                  type="button"
                  className="btn-ghost px-2 py-1 text-xs"
                  disabled={i === ordered.length - 1}
                  onClick={() => move(i, 1)}
                >
                  ↓
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      <p className="mb-2 text-sm text-[color:var(--color-muted)]">
        Characters {ordered.length ? `(${ordered.length} selected)` : ''}
      </p>
      {all.length === 0 ? (
        <p className="text-sm text-[color:var(--color-muted)]">No characters yet. Add some in Settings.</p>
      ) : (
        <ul className="mb-6 max-h-[40vh] space-y-1 overflow-y-auto">
          {all.map((c) => {
            const on = selectedIds.has(c.id)
            return (
              <li key={c.id}>
                <button
                  type="button"
                  className={`flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left ${
                    on ? 'bg-[color:var(--color-accent)]/15' : 'hover:bg-white/5'
                  }`}
                  onClick={() => toggleMember(c)}
                >
                  <span
                    className={`flex h-5 w-5 items-center justify-center rounded border text-xs ${
                      on
                        ? 'border-[color:var(--color-accent)] bg-[color:var(--color-accent)] text-[#1a1408]'
                        : 'border-white/30'
                    }`}
                  >
                    {on ? '✓' : ''}
                  </span>
                  <span className="font-medium">{c.name}</span>
                </button>
              </li>
            )
          })}
        </ul>
      )}

      <button
        type="button"
        className="btn-primary w-full"
        disabled={busy || (isEdit ? ordered.length < 1 : ordered.length < 2)}
        onClick={() => void handleSubmit()}
      >
        {busy ? 'Working…' : isEdit ? 'Save cast…' : 'Start group chat'}
      </button>
    </div>
  )
}
