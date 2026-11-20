import { useCallback, useEffect, useState } from 'react'
import type { Character, ChatSession } from '../../models/types'
import { createSoloChat, deleteChat, listAllChats } from '../../services/chatRepository'
import { listCharacters } from '../../services/libraryRepository'
import { createWorkshop, listWorkshops } from '../../services/workshopRepository'
import type { WorldWorkshop } from '../../models/types'

type Props = {
  refreshKey: number
  onOpenChat: (chatId: string) => void
  onOpenSettings: () => void
  onOpenGroupSetup: () => void
  onOpenCreationCenter: () => void
  onOpenWorkshop: (id: string) => void
  onOpenCharactersForPick?: () => void
}

export function HomeView({
  refreshKey,
  onOpenChat,
  onOpenSettings,
  onOpenGroupSetup,
  onOpenCreationCenter,
  onOpenWorkshop,
}: Props) {
  const [chats, setChats] = useState<ChatSession[]>([])
  const [characters, setCharacters] = useState<Character[]>([])
  const [workshops, setWorkshops] = useState<WorldWorkshop[]>([])
  const [newOpen, setNewOpen] = useState(false)
  const [picking, setPicking] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const reload = useCallback(async () => {
    setChats(await listAllChats())
    setCharacters(await listCharacters())
    setWorkshops(await listWorkshops())
  }, [])

  useEffect(() => {
    void reload()
  }, [reload, refreshKey])

  async function startSolo(character: Character) {
    const session = await createSoloChat({ character })
    setPicking(false)
    setNewOpen(false)
    onOpenChat(session.id)
  }

  return (
    <div className="relative mx-auto min-h-full w-full max-w-xl px-4 pb-28 pt-3">
      <header className="mb-4 flex items-center justify-between">
        <h1 className="font-heading text-3xl font-semibold tracking-tight">Anima</h1>
        <button
          type="button"
          className="btn-ghost text-xl text-[color:var(--color-accent)]"
          aria-label="Settings"
          onClick={onOpenSettings}
        >
          ⚙
        </button>
      </header>

      {error && <p className="mb-3 text-sm text-[color:var(--color-error)]">{error}</p>}

      {workshops.length > 0 && (
        <section className="mb-4">
          <div className="mb-2 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-[color:var(--color-accent)]">Creation Center</h2>
            <button type="button" className="btn-ghost px-2 py-1 text-xs" onClick={onOpenCreationCenter}>
              All worlds
            </button>
          </div>
          <div className="flex gap-2 overflow-x-auto pb-1">
            {workshops.slice(0, 8).map((w) => (
              <button
                key={w.id}
                type="button"
                className="glass-panel h-[88px] w-[140px] shrink-0 px-3 py-2 text-left"
                onClick={() => onOpenWorkshop(w.id)}
              >
                <div className="truncate text-sm font-semibold">{w.name}</div>
                <div className="mt-1 line-clamp-2 text-xs text-[color:var(--color-muted)]">
                  {(w.worldSummary || 'Workshop').slice(0, 60)}
                </div>
              </button>
            ))}
          </div>
        </section>
      )}

      {chats.length === 0 ? (
        <div className="flex flex-col items-center justify-center px-6 py-20 text-center">
          <div className="mb-3 text-4xl opacity-40">💬</div>
          <h2 className="font-heading text-xl font-semibold">No chats yet</h2>
          <p className="mt-2 max-w-sm text-sm text-[color:var(--color-muted)]">
            Your roleplay journal lives here. Start a solo chat with a character card.
          </p>
          <button
            type="button"
            className="btn-primary mt-6"
            onClick={() => {
              if (!characters.length) {
                setError('Add a character first (Settings → Characters).')
                onOpenSettings()
                return
              }
              setPicking(true)
            }}
          >
            Start a chat
          </button>
        </div>
      ) : (
        <ul className="divide-y divide-white/5 pb-4">
          {chats.map((c) => {
            const preview =
              [...c.messages].reverse().find((m) => m.text.trim())?.text.slice(0, 90) ??
              'Empty chat'
            const when = c.updatedAt
              ? new Date(c.updatedAt).toLocaleString(undefined, {
                  month: 'numeric',
                  day: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                })
              : ''
            const isGroup = Boolean(c.isGroup || (c.participantIds?.length ?? 0) > 1)
            return (
              <li key={c.id}>
                <button
                  type="button"
                  className="flex w-full items-start gap-3 py-3.5 text-left hover:bg-white/[0.03]"
                  onClick={() => onOpenChat(c.id)}
                  onContextMenu={(e) => {
                    e.preventDefault()
                    if (confirm('Delete this chat?')) {
                      void deleteChat(c.id).then(reload)
                    }
                  }}
                >
                  <div className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[color:var(--color-surface-high)] text-sm text-[color:var(--color-accent)]">
                    {isGroup ? '👥' : (c.title ?? c.name ?? '?').slice(0, 1).toUpperCase()}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-semibold">{c.title ?? c.name ?? 'Chat'}</div>
                    <div className="truncate text-sm text-[color:var(--color-muted)]">
                      {preview}
                      {when ? ` · ${when}` : ''}
                    </div>
                  </div>
                </button>
              </li>
            )
          })}
        </ul>
      )}

      <button
        type="button"
        className="btn-primary fixed bottom-6 right-5 z-20 shadow-lg shadow-black/40"
        onClick={() => setNewOpen(true)}
      >
        + New
      </button>

      {newOpen && (
        <div className="fixed inset-0 z-40 flex items-end justify-center bg-black/60 sm:items-center">
          <div className="sheet-panel w-full max-w-md p-4 sm:mx-4">
            <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-white/20 sm:hidden" />
            <h3 className="font-heading mb-3 text-lg font-semibold">New</h3>
            <button
              type="button"
              className="settings-row"
              onClick={() => {
                if (!characters.length) {
                  setError('Add a character first (Settings → Characters).')
                  setNewOpen(false)
                  onOpenSettings()
                  return
                }
                setNewOpen(false)
                setPicking(true)
              }}
            >
              <span className="flex-1 font-medium">Solo chat</span>
              <span>›</span>
            </button>
            <button
              type="button"
              className="settings-row"
              onClick={() => {
                if (characters.length < 2) {
                  setError('Add at least two characters for a group chat (Settings → Characters).')
                  setNewOpen(false)
                  onOpenSettings()
                  return
                }
                setNewOpen(false)
                onOpenGroupSetup()
              }}
            >
              <span className="flex-1 font-medium">Group chat</span>
              <span>›</span>
            </button>
            <button
              type="button"
              className="settings-row"
              onClick={() => {
                setNewOpen(false)
                void createWorkshop()
                  .then((w) => onOpenWorkshop(w.id))
                  .catch((err) => setError(err instanceof Error ? err.message : String(err)))
              }}
            >
              <span className="flex-1 font-medium">New workshop</span>
              <span>›</span>
            </button>
            <button type="button" className="btn-outline mt-4 w-full" onClick={() => setNewOpen(false)}>
              Cancel
            </button>
          </div>
        </div>
      )}

      {picking && (
        <div className="fixed inset-0 z-40 flex items-end justify-center bg-black/60 sm:items-center">
          <div className="sheet-panel w-full max-w-md p-4 sm:mx-4">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="font-heading text-lg font-semibold">Start chat with…</h3>
              <button type="button" className="btn-ghost text-sm" onClick={() => setPicking(false)}>
                Close
              </button>
            </div>
            <ul className="max-h-[50vh] space-y-1 overflow-y-auto">
              {characters.map((c) => (
                <li key={c.id}>
                  <button
                    type="button"
                    className="w-full rounded-xl px-3 py-3 text-left hover:bg-[color:var(--color-accent)]/10"
                    onClick={() => void startSolo(c)}
                  >
                    {c.name}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </div>
  )
}
