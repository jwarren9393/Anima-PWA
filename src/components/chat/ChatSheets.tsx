import { useState, type ReactNode } from 'react'
import {
  REWRITE_MODE_LABELS,
  type RewriteMode,
} from '../../services/replyRewriteService'
import {
  formatMemorySummary,
  parseMemorySummary,
  type MemorySummaryDocument,
} from '../../services/memorySummary'

type SheetShellProps = {
  title: string
  onClose: () => void
  children: ReactNode
}

function SheetShell({ title, onClose, children }: SheetShellProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-3 sm:items-center">
      <div className="glass-panel max-h-[85vh] w-full max-w-lg overflow-y-auto rounded-2xl p-4">
        <div className="mb-3 flex items-center justify-between gap-2">
          <h3 className="text-lg font-medium" style={{ fontFamily: 'var(--font-display)' }}>
            {title}
          </h3>
          <button type="button" className="btn-ghost px-2 py-1 text-xs" onClick={onClose}>
            Close
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}

export function NarratorSheet(props: {
  initial?: string
  busy?: boolean
  onClose: () => void
  onGenerate: (nudge: string) => Promise<string>
  onPost: (text: string) => void
}) {
  const [nudge, setNudge] = useState('')
  const [text, setText] = useState(props.initial ?? '')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  return (
    <SheetShell title="Narrator" onClose={props.onClose}>
      <p className="mb-3 text-sm text-white/55">
        Omniscient scene voice. Posted as a Narrator card in the timeline.
      </p>
      <label className="block text-sm text-white/65">
        Optional nudge
        <input
          className="field-input mt-1"
          value={nudge}
          onChange={(e) => setNudge(e.target.value)}
          placeholder="Storm rolls in…"
        />
      </label>
      <label className="mt-3 block text-sm text-white/65">
        Narrator line
        <textarea
          className="field-input mt-1 min-h-[7rem]"
          value={text}
          onChange={(e) => setText(e.target.value)}
        />
      </label>
      {error && <p className="mt-2 text-sm text-rose-300">{error}</p>}
      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          className="btn-ghost"
          disabled={busy || props.busy}
          onClick={() => {
            setBusy(true)
            setError(null)
            void props
              .onGenerate(nudge)
              .then((line) => setText(line))
              .catch((err) => setError(err instanceof Error ? err.message : String(err)))
              .finally(() => setBusy(false))
          }}
        >
          Generate
        </button>
        <button
          type="button"
          className="btn-primary"
          disabled={!text.trim() || busy}
          onClick={() => props.onPost(text.trim())}
        >
          Post
        </button>
      </div>
    </SheetShell>
  )
}

export function DirectorSheet(props: {
  onClose: () => void
  onPost: (text: string) => void
}) {
  const [text, setText] = useState('')
  return (
    <SheetShell title="Director" onClose={props.onClose}>
      <p className="mb-3 text-sm text-white/55">
        Mandatory instruction for the <strong>next</strong> AI reply only.
      </p>
      <textarea
        className="field-input min-h-[6rem]"
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Have them refuse, but soften at the end…"
        autoFocus
      />
      <button
        type="button"
        className="btn-primary mt-3"
        disabled={!text.trim()}
        onClick={() => props.onPost(text.trim())}
      >
        Post Director note
      </button>
    </SheetShell>
  )
}

export function MyLineSheet(props: {
  onClose: () => void
  onWrite: (guideNote: string | null) => void
}) {
  const [guide, setGuide] = useState('')
  return (
    <SheetShell title="My line…" onClose={props.onClose}>
      <p className="mb-3 text-sm text-white/55">
        Ask the AI to write your next line as {'{{user}}'} in first person.
      </p>
      <label className="block text-sm text-white/65">
        Steer my line (optional)
        <textarea
          className="field-input mt-1 min-h-[5rem]"
          value={guide}
          onChange={(e) => setGuide(e.target.value)}
          placeholder="Be wary, but curious about the letter…"
        />
      </label>
      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          className="btn-primary"
          onClick={() => props.onWrite(guide.trim() || null)}
        >
          Steer my line
        </button>
        <button type="button" className="btn-ghost" onClick={() => props.onWrite(null)}>
          Just write it (no steers)
        </button>
      </div>
    </SheetShell>
  )
}

export function PathsSheet(props: {
  options: string[]
  direction: string
  busy?: boolean
  onClose: () => void
  onDirection: (v: string) => void
  onRefresh: () => void
  onUse: (text: string) => void
  onCombine: (selected: string[]) => void
}) {
  const [selected, setSelected] = useState<Set<number>>(new Set())

  function toggle(i: number) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(i)) next.delete(i)
      else next.add(i)
      return next
    })
  }

  return (
    <SheetShell title="Paths" onClose={props.onClose}>
      <p className="mb-3 text-sm text-white/55">
        Brainstorm first-person options for your next line. Pick one into the composer, or combine.
      </p>
      <label className="block text-sm text-white/65">
        Steer these paths (optional)
        <input
          className="field-input mt-1"
          value={props.direction}
          onChange={(e) => props.onDirection(e.target.value)}
          placeholder="Cautious approaches only…"
        />
      </label>
      <button
        type="button"
        className="btn-ghost mt-3"
        disabled={props.busy}
        onClick={props.onRefresh}
      >
        {props.options.length ? 'Refresh paths' : 'Generate paths'}
      </button>
      <ul className="mt-3 space-y-2">
        {props.options.map((opt, i) => (
          <li key={i} className="rounded-xl border border-white/10 bg-black/20 p-3">
            <label className="flex gap-2 text-sm">
              <input type="checkbox" checked={selected.has(i)} onChange={() => toggle(i)} />
              <span className="whitespace-pre-wrap text-white/85">{opt}</span>
            </label>
            <button
              type="button"
              className="mt-2 text-xs text-gold-400"
              onClick={() => props.onUse(opt)}
            >
              Use in composer
            </button>
          </li>
        ))}
      </ul>
      {selected.size >= 2 && (
        <button
          type="button"
          className="btn-primary mt-3"
          disabled={props.busy}
          onClick={() =>
            props.onCombine(
              Array.from(selected)
                .sort()
                .map((i) => props.options[i]!)
                .filter(Boolean),
            )
          }
        >
          Combine selected
        </button>
      )}
    </SheetShell>
  )
}

export function RewriteSheet(props: {
  onClose: () => void
  onRewrite: (mode: RewriteMode, custom?: string) => void
}) {
  const [mode, setMode] = useState<RewriteMode>('fix')
  const [custom, setCustom] = useState('')
  return (
    <SheetShell title="Rewrite reply" onClose={props.onClose}>
      <div className="space-y-2">
        {(Object.keys(REWRITE_MODE_LABELS) as RewriteMode[]).map((m) => (
          <label key={m} className="flex items-center gap-2 text-sm text-white/80">
            <input
              type="radio"
              name="rewrite"
              checked={mode === m}
              onChange={() => setMode(m)}
            />
            {REWRITE_MODE_LABELS[m]}
          </label>
        ))}
      </div>
      {mode === 'custom' && (
        <textarea
          className="field-input mt-3 min-h-[4rem]"
          value={custom}
          onChange={(e) => setCustom(e.target.value)}
          placeholder="Your rewrite instruction…"
        />
      )}
      <button
        type="button"
        className="btn-primary mt-3"
        onClick={() => props.onRewrite(mode, custom)}
      >
        Rewrite
      </button>
    </SheetShell>
  )
}

export function MemorySheet(props: {
  summary: string
  coveredCount: number
  messageCount: number
  autoEvery: number
  busy?: boolean
  onClose: () => void
  onSave: (summary: string, autoEvery: number) => void
  onSummarizeNow: () => void
}) {
  const [doc, setDoc] = useState<MemorySummaryDocument>(() =>
    parseMemorySummary(props.summary),
  )
  const [autoEvery, setAutoEvery] = useState(props.autoEvery)
  const [sceneText, setSceneText] = useState(
    doc.scene.map((l) => (l.pinned ? `[pin] ${l.text}` : l.text)).join('\n'),
  )
  const [ledgerText, setLedgerText] = useState(
    doc.ledger.map((l) => (l.pinned ? `[pin] ${l.text}` : l.text)).join('\n'),
  )

  function save() {
    const next = parseMemorySummary(
      `## Scene\n${sceneText
        .split('\n')
        .map((l) => l.trim())
        .filter(Boolean)
        .map((l) => `- ${l}`)
        .join('\n')}\n## Ledger\n${ledgerText
        .split('\n')
        .map((l) => l.trim())
        .filter(Boolean)
        .map((l) => `- ${l}`)
        .join('\n')}`,
    )
    setDoc(next)
    props.onSave(formatMemorySummary(next), autoEvery)
  }

  return (
    <SheetShell title="Memory summary" onClose={props.onClose}>
      <p className="mb-2 text-xs text-white/45">
        Covered {props.coveredCount} / {props.messageCount} messages. Prefix a ledger line with
        [pin] to protect it.
      </p>
      <label className="block text-sm text-white/65">
        Scene
        <textarea
          className="field-input mt-1 min-h-[5rem]"
          value={sceneText}
          onChange={(e) => setSceneText(e.target.value)}
        />
      </label>
      <label className="mt-3 block text-sm text-white/65">
        Ledger
        <textarea
          className="field-input mt-1 min-h-[8rem]"
          value={ledgerText}
          onChange={(e) => setLedgerText(e.target.value)}
        />
      </label>
      <label className="mt-3 block text-sm text-white/65">
        Auto-summarize every N messages (0 = off)
        <input
          className="field-input mt-1"
          type="number"
          min={0}
          value={autoEvery}
          onChange={(e) => setAutoEvery(Number(e.target.value) || 0)}
        />
      </label>
      <div className="mt-3 flex flex-wrap gap-2">
        <button type="button" className="btn-primary" onClick={save}>
          Save
        </button>
        <button
          type="button"
          className="btn-ghost"
          disabled={props.busy}
          onClick={props.onSummarizeNow}
        >
          Summarize now
        </button>
      </div>
    </SheetShell>
  )
}

export function AuthorsNoteSheet(props: {
  value: string
  onClose: () => void
  onSave: (note: string) => void
}) {
  const [text, setText] = useState(props.value)
  return (
    <SheetShell title="Author's Note" onClose={props.onClose}>
      <textarea
        className="field-input min-h-[7rem]"
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Per-chat steering injected every turn…"
      />
      <button type="button" className="btn-primary mt-3" onClick={() => props.onSave(text)}>
        Save note
      </button>
    </SheetShell>
  )
}

export function GroupReactSheet(props: {
  cast: { id: string; name: string }[]
  busy?: boolean
  onClose: () => void
  onGenerate: (speakerIds: string[], nudge: string) => void
}) {
  const [selected, setSelected] = useState<string[]>(() => props.cast.map((c) => c.id))
  const [nudge, setNudge] = useState('')

  function toggle(id: string) {
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))
  }

  return (
    <SheetShell title="Group react" onClose={props.onClose}>
      <p className="mb-3 text-sm text-white/55">
        Pick at least two cast members for a simultaneous reaction beat.
      </p>
      <ul className="mb-3 space-y-1">
        {props.cast.map((c) => {
          const on = selected.includes(c.id)
          return (
            <li key={c.id}>
              <button
                type="button"
                className={`w-full rounded-xl px-3 py-2 text-left text-sm ${
                  on ? 'bg-[color:var(--color-accent)]/15 text-[color:var(--color-accent)]' : 'hover:bg-white/5'
                }`}
                onClick={() => toggle(c.id)}
              >
                {on ? '✓ ' : ''}
                {c.name}
              </button>
            </li>
          )
        })}
      </ul>
      <label className="block text-sm text-white/65">
        Optional nudge
        <input
          className="field-input mt-1"
          value={nudge}
          onChange={(e) => setNudge(e.target.value)}
          placeholder="They all notice the door…"
        />
      </label>
      <button
        type="button"
        className="btn-primary mt-3"
        disabled={props.busy || selected.length < 2}
        onClick={() => props.onGenerate(selected, nudge)}
      >
        Generate beat
      </button>
    </SheetShell>
  )
}
