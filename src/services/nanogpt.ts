/**
 * NanoGPT browser client — PAYG + subscription chat, SSE streaming with cancel,
 * model catalog, favorites helpers, and credit balance.
 */

/** Official direct API host (docs.nano-gpt.com). Website host kept as fallback. */
export const API_HOST = 'https://api.nano-gpt.com'
export const SITE_HOST = 'https://nano-gpt.com'

export const PAYG_CHAT_URL = `${API_HOST}/api/v1/chat/completions`
export const SUBSCRIPTION_CHAT_URL = `${API_HOST}/api/subscription/v1/chat/completions`
export const CREDITS_URL = `${API_HOST}/api/check-balance`
export const MODELS_URL = `${API_HOST}/api/v1/models`
export const DETAILED_MODELS_URL = `${API_HOST}/api/v1/models?detailed=true`

export type ChatApiMessage = {
  role: 'system' | 'user' | 'assistant'
  content: string
}

export type StreamChatOptions = {
  apiKey: string
  model: string
  messages: ChatApiMessage[]
  useSubscription?: boolean
  temperature?: number
  top_p?: number
  max_tokens?: number
  frequency_penalty?: number
  presence_penalty?: number
  signal?: AbortSignal
  onDelta?: (chunk: string, fullText: string) => void
}

export class NanoGptError extends Error {
  status?: number
  isCors?: boolean
  constructor(message: string, opts?: { status?: number; isCors?: boolean }) {
    super(message)
    this.name = 'NanoGptError'
    this.status = opts?.status
    this.isCors = opts?.isCors
  }
}

export class NanoGptCancelledException extends Error {
  partialText: string
  constructor(partialText: string) {
    super('Generation stopped.')
    this.name = 'NanoGptCancelledException'
    this.partialText = partialText
  }
}

export type CatalogModel = {
  id: string
  name: string
  description?: string
  contextLength?: number
  maxOutput?: number
  provider?: string
  category?: string
  pricing?: { prompt?: number; completion?: number }
  capabilities?: string[]
  raw?: Record<string, unknown>
}

export type CreditUsage = {
  balance?: number
  credits?: number
  raw: unknown
  display: string
}

function authHeaders(apiKey: string): HeadersInit {
  return {
    Authorization: `Bearer ${apiKey}`,
    'Content-Type': 'application/json',
    Accept: 'application/json',
  }
}

function chatUrl(useSubscription: boolean): string {
  return useSubscription ? SUBSCRIPTION_CHAT_URL : PAYG_CHAT_URL
}

function explainFetchFailure(err: unknown): NanoGptError {
  if (err instanceof NanoGptError) return err
  if (err instanceof DOMException && err.name === 'AbortError') {
    return new NanoGptError('Request was cancelled.')
  }
  const msg = err instanceof Error ? err.message : String(err)
  const looksCors =
    /failed to fetch|networkerror|cors|access-control|load failed/i.test(msg)
  if (looksCors) {
    return new NanoGptError(
      'Could not reach NanoGPT from this browser (possible CORS / allowed-origin block). Confirm your key works at nano-gpt.com, and that the site origin is allowed for browser API use. If this keeps failing, try from the installed PWA or ask NanoGPT support about browser origins.',
      { isCors: true },
    )
  }
  return new NanoGptError(msg || 'Network request failed.')
}

async function readErrorBody(res: Response): Promise<string> {
  try {
    const text = await res.text()
    if (!text) return res.statusText || `HTTP ${res.status}`
    try {
      const json = JSON.parse(text) as { error?: { message?: string } | string; message?: string }
      if (typeof json.error === 'string') return json.error
      if (json.error && typeof json.error === 'object' && json.error.message) {
        return json.error.message
      }
      if (json.message) return json.message
    } catch {
      /* plain text */
    }
    return text.slice(0, 400)
  } catch {
    return res.statusText || `HTTP ${res.status}`
  }
}

/**
 * Parse an OpenAI-style SSE stream body into incremental text deltas.
 * Exported for unit tests.
 */
export async function parseSseChatStream(
  body: ReadableStream<Uint8Array>,
  options: {
    signal?: AbortSignal
    onDelta?: (chunk: string, fullText: string) => void
  } = {},
): Promise<string> {
  const reader = body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  let fullText = ''

  try {
    while (true) {
      if (options.signal?.aborted) {
        throw new NanoGptCancelledException(fullText)
      }
      const { done, value } = await reader.read()
      if (done) break
      buffer += decoder.decode(value, { stream: true })

      const lines = buffer.split(/\r?\n/)
      buffer = lines.pop() ?? ''

      for (const line of lines) {
        const trimmed = line.trim()
        if (!trimmed.startsWith('data:')) continue
        const data = trimmed.slice(5).trim()
        if (!data) continue
        if (data === '[DONE]') {
          return fullText
        }
        try {
          const json = JSON.parse(data) as {
            choices?: Array<{ delta?: { content?: string }; text?: string }>
          }
          const delta =
            json.choices?.[0]?.delta?.content ??
            json.choices?.[0]?.text ??
            ''
          if (delta) {
            fullText += delta
            options.onDelta?.(delta, fullText)
          }
        } catch {
          // ignore malformed SSE chunks
        }
      }
    }
  } catch (err) {
    if (err instanceof NanoGptCancelledException) throw err
    if (options.signal?.aborted || (err instanceof DOMException && err.name === 'AbortError')) {
      throw new NanoGptCancelledException(fullText)
    }
    throw err
  } finally {
    try {
      reader.releaseLock()
    } catch {
      /* ignore */
    }
  }

  if (options.signal?.aborted) {
    throw new NanoGptCancelledException(fullText)
  }
  return fullText
}

export async function streamChatCompletion(
  options: StreamChatOptions,
): Promise<string> {
  const {
    apiKey,
    model,
    messages,
    useSubscription = false,
    signal,
    onDelta,
    ...sampling
  } = options

  if (!apiKey.trim()) {
    throw new NanoGptError('Add your NanoGPT API key first.')
  }

  let res: Response
  try {
    res = await fetch(chatUrl(useSubscription), {
      method: 'POST',
      headers: authHeaders(apiKey),
      signal,
      body: JSON.stringify({
        model,
        messages,
        stream: true,
        temperature: sampling.temperature,
        top_p: sampling.top_p,
        max_tokens: sampling.max_tokens,
        frequency_penalty: sampling.frequency_penalty,
        presence_penalty: sampling.presence_penalty,
      }),
    })
  } catch (err) {
    if (signal?.aborted) throw new NanoGptCancelledException('')
    throw explainFetchFailure(err)
  }

  if (!res.ok) {
    throw new NanoGptError(await readErrorBody(res), { status: res.status })
  }
  if (!res.body) {
    throw new NanoGptError('NanoGPT returned an empty stream body.')
  }

  try {
    return await parseSseChatStream(res.body, { signal, onDelta })
  } catch (err) {
    if (err instanceof NanoGptCancelledException) throw err
    if (signal?.aborted) {
      throw new NanoGptCancelledException('')
    }
    throw explainFetchFailure(err)
  }
}

export async function completeChat(options: Omit<StreamChatOptions, 'onDelta'>): Promise<string> {
  const {
    apiKey,
    model,
    messages,
    useSubscription = false,
    signal,
    ...sampling
  } = options

  if (!apiKey.trim()) {
    throw new NanoGptError('Add your NanoGPT API key first.')
  }

  let res: Response
  try {
    res = await fetch(chatUrl(useSubscription), {
      method: 'POST',
      headers: authHeaders(apiKey),
      signal,
      body: JSON.stringify({
        model,
        messages,
        stream: false,
        temperature: sampling.temperature,
        top_p: sampling.top_p,
        max_tokens: sampling.max_tokens,
        frequency_penalty: sampling.frequency_penalty,
        presence_penalty: sampling.presence_penalty,
      }),
    })
  } catch (err) {
    if (signal?.aborted) throw new NanoGptCancelledException('')
    throw explainFetchFailure(err)
  }

  if (!res.ok) {
    throw new NanoGptError(await readErrorBody(res), { status: res.status })
  }

  const json = (await res.json()) as {
    choices?: Array<{ message?: { content?: string }; text?: string }>
  }
  return (
    json.choices?.[0]?.message?.content ??
    json.choices?.[0]?.text ??
    ''
  )
}

function normalizeModel(raw: Record<string, unknown>): CatalogModel {
  const id = String(raw.id ?? raw.model ?? raw.name ?? '')
  const name = String(raw.name ?? raw.display_name ?? id)
  const provider =
    raw.provider != null
      ? String(raw.provider)
      : id.includes('/')
        ? id.split('/')[0]
        : undefined
  const category =
    raw.category != null
      ? String(raw.category)
      : Array.isArray(raw.categories)
        ? String((raw.categories as unknown[])[0] ?? '')
        : undefined

  return {
    id,
    name,
    description: raw.description != null ? String(raw.description) : undefined,
    contextLength:
      typeof raw.context_length === 'number'
        ? raw.context_length
        : typeof raw.contextLength === 'number'
          ? raw.contextLength
          : undefined,
    maxOutput:
      typeof raw.max_output === 'number'
        ? raw.max_output
        : typeof raw.maxOutput === 'number'
          ? raw.maxOutput
          : undefined,
    provider,
    category: category || undefined,
    pricing:
      raw.pricing && typeof raw.pricing === 'object'
        ? (raw.pricing as CatalogModel['pricing'])
        : undefined,
    capabilities: Array.isArray(raw.capabilities)
      ? raw.capabilities.map(String)
      : undefined,
    raw,
  }
}

export async function fetchTextModelCatalog(apiKey: string): Promise<CatalogModel[]> {
  if (!apiKey.trim()) {
    throw new NanoGptError('Add your NanoGPT API key first.')
  }

  const tryUrls = [
    DETAILED_MODELS_URL,
    MODELS_URL,
    `${SITE_HOST}/api/v1/models?detailed=true`,
    `${SITE_HOST}/api/v1/models`,
  ]
  let lastError: NanoGptError | null = null

  for (const url of tryUrls) {
    try {
      const res = await fetch(url, {
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'x-api-key': apiKey,
          Accept: 'application/json',
        },
      })
      if (!res.ok) {
        lastError = new NanoGptError(await readErrorBody(res), { status: res.status })
        continue
      }
      const json = (await res.json()) as unknown
      const list = extractModelList(json)
        .map((item) =>
          normalizeModel(
            (item && typeof item === 'object' ? item : {}) as Record<string, unknown>,
          ),
        )
        .filter((m) => m.id)
        // Skip paused / unavailable detailed entries when the API marks them
        .filter((m) => m.raw?.available !== false)
      if (list.length) return list
    } catch (err) {
      lastError = explainFetchFailure(err)
    }
  }

  throw lastError ?? new NanoGptError('Could not load the model catalog.')
}

function extractModelList(json: unknown): unknown[] {
  if (Array.isArray(json)) return json
  if (json && typeof json === 'object') {
    const obj = json as Record<string, unknown>
    for (const key of ['data', 'models', 'text', 'textModels']) {
      const v = obj[key]
      if (Array.isArray(v)) return v
      if (v && typeof v === 'object' && !Array.isArray(v)) {
        const nested = v as Record<string, unknown>
        if (Array.isArray(nested.data)) return nested.data
        if (Array.isArray(nested.models)) return nested.models
      }
    }
  }
  return []
}

export function filterModels(
  models: CatalogModel[],
  opts: { query?: string; provider?: string; category?: string; favoriteIds?: Set<string> },
): CatalogModel[] {
  const q = opts.query?.trim().toLowerCase() ?? ''
  return models.filter((m) => {
    if (opts.favoriteIds && !opts.favoriteIds.has(m.id)) return false
    if (opts.provider && opts.provider !== 'all' && m.provider !== opts.provider) {
      return false
    }
    if (opts.category && opts.category !== 'all') {
      if (opts.category === 'uncensored') {
        const hay = `${m.id} ${m.name} ${m.description ?? ''} ${m.category ?? ''}`.toLowerCase()
        if (!/uncensor|derestrict|nsfw|abliterat|unfiltered/.test(hay)) return false
      } else if (m.category !== opts.category) {
        return false
      }
    }
    if (!q) return true
    const hay = `${m.id} ${m.name} ${m.description ?? ''} ${m.provider ?? ''}`.toLowerCase()
    return hay.includes(q)
  })
}

export async function fetchCreditUsage(apiKey: string): Promise<CreditUsage> {
  if (!apiKey.trim()) {
    throw new NanoGptError('Add your NanoGPT API key first.')
  }

  // Docs: POST /api/check-balance (api.nano-gpt.com or nano-gpt.com)
  const urls = [CREDITS_URL, `${SITE_HOST}/api/check-balance`]
  let lastError: NanoGptError | null = null

  for (const url of urls) {
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'x-api-key': apiKey,
          Accept: 'application/json',
          'Content-Type': 'application/json',
        },
        body: '{}',
      })
      if (!res.ok) {
        lastError = new NanoGptError(await readErrorBody(res), { status: res.status })
        continue
      }
      const raw = await res.json()
      return normalizeCredits(raw)
    } catch (err) {
      lastError = explainFetchFailure(err)
    }
  }

  throw lastError ?? new NanoGptError('Could not load credit balance.')
}

function normalizeCredits(raw: unknown): CreditUsage {
  const obj = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>
  const usdRaw = obj.usd_balance ?? obj.balance ?? obj.credits ?? obj.remaining
  const nanoRaw = obj.nano_balance
  const usd =
    typeof usdRaw === 'number'
      ? usdRaw
      : typeof usdRaw === 'string' && usdRaw.trim() && !Number.isNaN(Number(usdRaw))
        ? Number(usdRaw)
        : undefined
  const nano =
    typeof nanoRaw === 'number'
      ? nanoRaw
      : typeof nanoRaw === 'string' && nanoRaw.trim() && !Number.isNaN(Number(nanoRaw))
        ? Number(nanoRaw)
        : undefined

  const parts: string[] = []
  if (usd != null) parts.push(`$${usd.toFixed(4).replace(/\.?0+$/, '')} USD`)
  if (nano != null) parts.push(`${nano} Nano`)
  const display =
    parts.length > 0 ? parts.join(' · ') : JSON.stringify(raw).slice(0, 120)

  return { balance: usd, credits: usd, raw, display }
}

/**
 * Prove the API key works by listing models (no retired-model dependency).
 * If a model id is provided, also send a tiny chat ping with that model.
 */
export async function testConnection(options: {
  apiKey: string
  useSubscription?: boolean
  model?: string
}): Promise<{ ok: true; reply: string } | { ok: false; error: string }> {
  try {
    const catalog = await fetchTextModelCatalog(options.apiKey)
    if (!catalog.length) {
      return { ok: false, error: 'Key reached NanoGPT, but the model list was empty.' }
    }

    const model = options.model?.trim()
    if (!model) {
      return {
        ok: true,
        reply: `Key OK — ${catalog.length} models available. Pick a default model below, then you can chat.`,
      }
    }

    const reply = await completeChat({
      apiKey: options.apiKey,
      useSubscription: options.useSubscription,
      model,
      messages: [{ role: 'user', content: 'Reply with exactly: OK' }],
      max_tokens: 16,
      temperature: 0,
    })
    return {
      ok: true,
      reply: `Key OK · model “${model}” replied: ${reply.trim() || '(empty)'}`,
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return { ok: false, error: message }
  }
}
