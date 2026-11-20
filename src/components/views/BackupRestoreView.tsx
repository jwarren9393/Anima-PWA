import { useRef, useState } from 'react'
import {
  AppBackupException,
  decodeBackup,
  downloadBackupFile,
  exportBackupFromDb,
  restoreBackupToDb,
  shortDescription,
  type AppBackupSummary,
} from '../../services/backupCodec'

type Props = {
  onRestored?: () => void
}

export function BackupRestoreView({ onRestored }: Props) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [summary, setSummary] = useState<AppBackupSummary | null>(null)
  const [exportNote, setExportNote] = useState<string | null>(null)

  async function handleImport(file: File) {
    setBusy(true)
    setError(null)
    setSummary(null)
    setExportNote(null)
    try {
      const buffer = new Uint8Array(await file.arrayBuffer())
      // Validate first for clearer errors
      decodeBackup(buffer)
      const result = await restoreBackupToDb(buffer)
      setSummary(result)
      onRestored?.()
    } catch (err) {
      const message =
        err instanceof AppBackupException
          ? err.message
          : err instanceof Error
            ? err.message
            : String(err)
      setError(message)
    } finally {
      setBusy(false)
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  async function handleExport() {
    setBusy(true)
    setError(null)
    setExportNote(null)
    try {
      const bundle = await exportBackupFromDb()
      downloadBackupFile(bundle)
      setExportNote(
        `Exported ${shortDescription(bundle.summary)}. API key was not included.`,
      )
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex w-full flex-col gap-5">
      <p className="text-sm text-[color:var(--color-muted)]">
        Move your library with a <code className="text-[color:var(--color-accent)]">.anima-backup</code> file.
        Local only — no cloud sync.
      </p>

      <section className="glass-panel space-y-4 p-5">
        <div className="rounded-xl border border-[color:var(--color-accent)]/25 bg-[color:var(--color-accent-deep)]/10 px-4 py-3 text-sm text-[color:var(--color-muted)]">
          <strong className="text-[color:var(--color-accent)]">API keys stay device-local.</strong> Restore
          never overwrites your key; exports never include it.
        </div>

        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            className="btn-primary"
            disabled={busy}
            onClick={() => inputRef.current?.click()}
          >
            Import .anima-backup
          </button>
          <button
            type="button"
            className="btn-ghost"
            disabled={busy}
            onClick={() => void handleExport()}
          >
            Export .anima-backup
          </button>
          <input
            ref={inputRef}
            type="file"
            accept=".anima-backup,application/json"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0]
              if (file) void handleImport(file)
            }}
          />
        </div>

        {busy && <p className="text-sm text-white/50">Working…</p>}
        {error && <p className="text-sm text-rose-300/90">{error}</p>}
        {exportNote && <p className="text-sm text-emerald-300/90">{exportNote}</p>}

        {summary && (
          <div className="rounded-xl border border-white/10 bg-black/25 px-4 py-4">
            <h2 className="font-medium text-white/90">Import complete</h2>
            <p className="mt-1 text-sm text-white/55">{shortDescription(summary)}</p>
            <ul className="mt-3 grid grid-cols-2 gap-2 text-sm text-white/70 sm:grid-cols-3">
              <li>Characters: {summary.characters ?? '—'}</li>
              <li>Personas: {summary.personas ?? '—'}</li>
              <li>Chats: {summary.chats ?? '—'}</li>
              <li>Lorebooks: {summary.lorebooks ?? '—'}</li>
              <li>Workshops: {summary.workshops ?? '—'}</li>
              <li>Avatars: {summary.avatarCount}</li>
            </ul>
          </div>
        )}
      </section>
    </div>
  )
}
