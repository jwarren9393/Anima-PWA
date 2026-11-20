import { useCallback, useEffect, useMemo, useState } from 'react'
import type { CatalogModel } from '../../services/nanogpt'
import {
  fetchCreditUsage,
  fetchTextModelCatalog,
  filterModels,
  testConnection,
} from '../../services/nanogpt'
import {
  clearApiKey,
  getApiKey,
  getChatModelId,
  getUseSubscription,
  listFavoriteModels,
  setApiKey,
  setChatModelId,
  setUseSubscription,
  toggleFavoriteModel,
} from '../../services/settingsStore'
import type { FavoriteModel } from '../../models/types'

type Props = {
  onSaved?: () => void
}

export function ApiSettingsView({ onSaved }: Props) {
  const [apiKey, setApiKeyInput] = useState('')
  const [hasStoredKey, setHasStoredKey] = useState(false)
  const [showKey, setShowKey] = useState(false)
  const [useSubscription, setUseSub] = useState(false)
  const [selectedModel, setSelectedModel] = useState('')
  const [models, setModels] = useState<CatalogModel[]>([])
  const [favorites, setFavorites] = useState<FavoriteModel[]>([])
  const [query, setQuery] = useState('')
  const [provider, setProvider] = useState('all')
  const [category, setCategory] = useState('all')
  const [credits, setCredits] = useState<string | null>(null)
  const [status, setStatus] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    const [key, sub, model, favs] = await Promise.all([
      getApiKey(),
      getUseSubscription(),
      getChatModelId(),
      listFavoriteModels(),
    ])
    setHasStoredKey(Boolean(key))
    setApiKeyInput(key ? '••••••••••••••••' : '')
    setUseSub(sub)
    setSelectedModel(model)
    setFavorites(favs)
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const favoriteIds = useMemo(
    () => new Set(favorites.map((f) => f.id)),
    [favorites],
  )

  const providers = useMemo(() => {
    const set = new Set<string>()
    for (const m of models) {
      if (m.provider) set.add(m.provider)
    }
    return ['all', ...Array.from(set).sort()]
  }, [models])

  const filtered = useMemo(() => {
    const base =
      category === 'favorites'
        ? filterModels(models, { query, provider, favoriteIds })
        : filterModels(models, {
            query,
            provider,
            category: category === 'all' ? 'all' : category,
          })
    return base.slice(0, 200)
  }, [models, query, provider, category, favoriteIds])

  async function handleSaveKey() {
    setError(null)
    setStatus(null)
    const value = apiKey.trim()
    if (!value || value.startsWith('••')) {
      setError('Enter your NanoGPT API key (paste a new key to replace the masked one).')
      return
    }
    await setApiKey(value)
    setHasStoredKey(true)
    setApiKeyInput('••••••••••••••••')
    setShowKey(false)
    setStatus('API key saved on this device only.')
    onSaved?.()
  }

  async function handleClearKey() {
    await clearApiKey()
    setApiKeyInput('')
    setHasStoredKey(false)
    setModels([])
    setCredits(null)
    setStatus('API key cleared from this device.')
    onSaved?.()
  }

  async function resolveKey(): Promise<string | null> {
    if (apiKey && !apiKey.startsWith('••')) return apiKey.trim()
    const stored = await getApiKey()
    if (stored) return stored
    setError('Save an API key first.')
    return null
  }

  async function handleTest() {
    setBusy(true)
    setError(null)
    setStatus(null)
    try {
      const key = await resolveKey()
      if (!key) return
      await setUseSubscription(useSubscription)
      const result = await testConnection({
        apiKey: key,
        useSubscription,
        model: selectedModel || undefined,
      })
      if (result.ok) {
        setStatus(`Connection OK — model replied: ${result.reply}`)
      } else {
        setError(result.error)
      }
    } finally {
      setBusy(false)
    }
  }

  async function handleCredits() {
    setBusy(true)
    setError(null)
    try {
      const key = await resolveKey()
      if (!key) return
      const usage = await fetchCreditUsage(key)
      setCredits(usage.display)
      setStatus(`Credits: ${usage.display}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setBusy(false)
    }
  }

  async function handleLoadModels() {
    setBusy(true)
    setError(null)
    try {
      const key = await resolveKey()
      if (!key) return
      const catalog = await fetchTextModelCatalog(key)
      setModels(catalog)
      setStatus(`Loaded ${catalog.length} models.`)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setBusy(false)
    }
  }

  async function handleSelectModel(id: string) {
    setSelectedModel(id)
    await setChatModelId(id)
    setStatus(`Default model set to ${id}`)
  }

  async function handleToggleFavorite(model: CatalogModel) {
    const next = await toggleFavoriteModel({ id: model.id, name: model.name })
    setFavorites(next)
  }

  async function handleToggleEndpoint(next: boolean) {
    setUseSub(next)
    await setUseSubscription(next)
  }

  return (
    <div className="flex w-full flex-col gap-5">
      <p className="text-sm text-[color:var(--color-muted)]">
        Key stays in IndexedDB only — never in backups. For local testing leave NanoGPT Allowed
        origins empty, or only <code className="text-[color:var(--color-accent)]">http://localhost:5173</code>.
      </p>

      <section className="glass-panel space-y-4 p-5">
        <label className="block text-sm text-white/70">
          NanoGPT API key
          <div className="mt-2 flex gap-2">
            <input
              className="field-input"
              type={showKey ? 'text' : 'password'}
              autoComplete="off"
              spellCheck={false}
              placeholder={hasStoredKey ? 'Key saved — paste to replace' : 'sk-…'}
              value={apiKey}
              onChange={(e) => setApiKeyInput(e.target.value)}
              onFocus={() => {
                if (apiKey.startsWith('••')) setApiKeyInput('')
              }}
            />
            <button
              type="button"
              className="btn-ghost shrink-0"
              onClick={() => setShowKey((v) => !v)}
            >
              {showKey ? 'Hide' : 'Show'}
            </button>
          </div>
        </label>

        <div className="flex flex-wrap gap-2">
          <button type="button" className="btn-primary" onClick={() => void handleSaveKey()}>
            Save key
          </button>
          <button
            type="button"
            className="btn-ghost"
            onClick={() => void handleClearKey()}
            disabled={!hasStoredKey && !apiKey}
          >
            Clear key
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-3 pt-1">
          <span className="text-sm text-white/60">Endpoint</span>
          <button
            type="button"
            className={`rounded-full px-3 py-1.5 text-sm ${
              !useSubscription
                ? 'bg-gold-500/20 text-gold-400 ring-1 ring-gold-500/40'
                : 'bg-white/5 text-white/60'
            }`}
            onClick={() => void handleToggleEndpoint(false)}
          >
            Pay-as-you-go
          </button>
          <button
            type="button"
            className={`rounded-full px-3 py-1.5 text-sm ${
              useSubscription
                ? 'bg-gold-500/20 text-gold-400 ring-1 ring-gold-500/40'
                : 'bg-white/5 text-white/60'
            }`}
            onClick={() => void handleToggleEndpoint(true)}
          >
            Subscription
          </button>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className="btn-ghost"
            disabled={busy}
            onClick={() => void handleTest()}
          >
            Test connection
          </button>
          <button
            type="button"
            className="btn-ghost"
            disabled={busy}
            onClick={() => void handleCredits()}
          >
            View credits
          </button>
          <button
            type="button"
            className="btn-ghost"
            disabled={busy}
            onClick={() => void handleLoadModels()}
          >
            Browse models
          </button>
        </div>

        {credits != null && (
          <p className="text-sm text-gold-400">Balance / credits: {credits}</p>
        )}
        {selectedModel && (
          <p className="text-sm text-white/55">
            Default model: <span className="text-white/85">{selectedModel}</span>
          </p>
        )}
        {status && <p className="text-sm text-emerald-300/90">{status}</p>}
        {error && <p className="text-sm text-rose-300/90">{error}</p>}
      </section>

      {models.length > 0 && (
        <section className="glass-panel space-y-3 rounded-2xl p-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <input
              className="field-input"
              placeholder="Search models…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            <select
              className="field-input sm:max-w-[10rem]"
              value={provider}
              onChange={(e) => setProvider(e.target.value)}
            >
              {providers.map((p) => (
                <option key={p} value={p}>
                  {p === 'all' ? 'All providers' : p}
                </option>
              ))}
            </select>
            <select
              className="field-input sm:max-w-[12rem]"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
            >
              <option value="all">All categories</option>
              <option value="favorites">⭐ Favorites</option>
              <option value="uncensored">Uncensored (broad)</option>
            </select>
          </div>

          <ul className="max-h-[28rem] space-y-2 overflow-y-auto pr-1">
            {filtered.map((m) => {
              const starred = favoriteIds.has(m.id)
              const selected = selectedModel === m.id
              return (
                <li
                  key={m.id}
                  className={`flex items-start gap-3 rounded-xl border px-3 py-3 ${
                    selected
                      ? 'border-gold-500/40 bg-gold-500/10'
                      : 'border-white/5 bg-black/20'
                  }`}
                >
                  <button
                    type="button"
                    className="mt-0.5 text-lg"
                    aria-label={starred ? 'Unstar model' : 'Star model'}
                    onClick={() => void handleToggleFavorite(m)}
                  >
                    {starred ? '⭐' : '☆'}
                  </button>
                  <button
                    type="button"
                    className="min-w-0 flex-1 text-left"
                    onClick={() => void handleSelectModel(m.id)}
                  >
                    <div className="truncate font-medium text-white/90">{m.name}</div>
                    <div className="truncate text-xs text-white/45">{m.id}</div>
                    {(m.provider || m.contextLength) && (
                      <div className="mt-1 text-xs text-white/40">
                        {[m.provider, m.contextLength ? `${m.contextLength} ctx` : null]
                          .filter(Boolean)
                          .join(' · ')}
                      </div>
                    )}
                  </button>
                </li>
              )
            })}
            {filtered.length === 0 && (
              <li className="py-6 text-center text-sm text-white/45">No models match.</li>
            )}
          </ul>
        </section>
      )}
    </div>
  )
}
