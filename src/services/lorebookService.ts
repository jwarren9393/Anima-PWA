import { estimateTokens } from '../lib/tokens'
import { newId } from '../lib/ids'
import type {
  ChatMessage,
  GlobalLorebook,
  LorebookBook,
  LorebookEntry,
} from '../models/types'

export type LorePosition = 'before' | 'after' | 'other'

export type LoreScanHit = {
  entryId: string
  bookId: string
  bookName: string
  label: string
  content: string
  position: LorePosition
  priority: number
  tokens: number
}

export type LoreScanResult = {
  beforeChar: LoreScanHit[]
  afterChar: LoreScanHit[]
  triggeredLabels: string[]
}

export type LoreScanOptions = {
  scanDepth?: number
  tokenBudget?: number
  recursive?: boolean
}

function entriesOf(book: LorebookBook): LorebookEntry[] {
  const raw = book.entries
  if (!raw) return []
  if (Array.isArray(raw)) return raw
  return Object.entries(raw).map(([key, entry]) => ({
    ...entry,
    id: entry.id ?? key,
  }))
}

function entryKeys(entry: LorebookEntry): string[] {
  const primary = Array.isArray(entry.keys) ? entry.keys.map(String) : []
  const key = entry.key
  if (typeof key === 'string' && key.trim()) {
    primary.push(...key.split(/[,;]/).map((s) => s.trim()).filter(Boolean))
  }
  return primary.map((k) => k.trim()).filter(Boolean)
}

function secondaryKeys(entry: LorebookEntry): string[] {
  const sec = entry.secondary_keys ?? entry.secondaryKeys
  if (!Array.isArray(sec)) return []
  return sec.map(String).map((k) => k.trim()).filter(Boolean)
}

function normalizePosition(entry: LorebookEntry): LorePosition {
  const p = entry.position
  if (typeof p === 'number') {
    // ST numeric: 0 before, 1 after, etc.
    if (p === 0) return 'before'
    if (p === 1) return 'after'
    return 'other'
  }
  const s = String(p ?? '').toLowerCase()
  if (!s || s.includes('before') || s === '0') return 'before'
  if (s.includes('after') || s === '1') return 'after'
  return 'other'
}

function entryEnabled(entry: LorebookEntry): boolean {
  return entry.enabled !== false && entry.disable !== true
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function haystackIncludesKeyword(haystack: string, keyword: string): boolean {
  const k = keyword.trim()
  if (!k) return false
  // Word-boundary-ish match; case-insensitive
  try {
    const re = new RegExp(`(?:^|[^\\p{L}\\p{N}_])${escapeRegex(k)}(?:[^\\p{L}\\p{N}_]|$)`, 'iu')
    return re.test(haystack)
  } catch {
    return haystack.toLowerCase().includes(k.toLowerCase())
  }
}

function buildScanText(messages: ChatMessage[], depth: number): string {
  const slice = messages.slice(-Math.max(1, depth))
  return slice
    .filter((m) => m.role === 'user' || m.role === 'assistant' || m.role === 'narrator')
    .map((m) => m.text)
    .join('\n')
}

function entryMatches(entry: LorebookEntry, haystack: string): boolean {
  if (!entryEnabled(entry)) return false
  if (entry.constant === true) return true

  const keys = entryKeys(entry)
  if (!keys.length) return false

  const primaryHit = keys.some((k) => haystackIncludesKeyword(haystack, k))
  if (!primaryHit) return false

  if (entry.selective) {
    const sec = secondaryKeys(entry)
    if (sec.length && !sec.some((k) => haystackIncludesKeyword(haystack, k))) {
      return false
    }
  }
  return true
}

function toHit(
  entry: LorebookEntry,
  book: GlobalLorebook | { id: string; name: string },
  index: number,
): LoreScanHit | null {
  const content = String(entry.content ?? '').trim()
  if (!content) return null
  const label = String(entry.comment ?? entry.name ?? entryKeys(entry)[0] ?? `entry-${index}`)
  const priority =
    typeof entry.priority === 'number'
      ? entry.priority
      : typeof entry.insertion_order === 'number'
        ? entry.insertion_order
        : index
  return {
    entryId: String(entry.id ?? `${book.id}-${index}`),
    bookId: book.id,
    bookName: book.name,
    label,
    content,
    position: normalizePosition(entry),
    priority,
    tokens: estimateTokens(content),
  }
}

/**
 * Scan recent chat text against global lorebooks + optional embedded character book.
 * Matches Flutter/ST style: depth window, priority budget, optional recursive scan.
 */
export function scanLorebooks(
  messages: ChatMessage[],
  books: GlobalLorebook[],
  opts: LoreScanOptions & { characterBook?: LorebookBook | null; characterId?: string } = {},
): LoreScanResult {
  const depth = opts.scanDepth ?? 4
  const budget = opts.tokenBudget ?? 512
  const recursive = opts.recursive ?? false

  let haystack = buildScanText(messages, depth)
  const candidates: LoreScanHit[] = []
  const seen = new Set<string>()

  const considerBook = (
    book: GlobalLorebook | { id: string; name: string; book: LorebookBook; enabled?: boolean },
  ) => {
    if (book.enabled === false) return
    entriesOf(book.book).forEach((entry, i) => {
      if (!entryMatches(entry, haystack)) return
      const hit = toHit(entry, book, i)
      if (!hit) return
      const key = `${hit.bookId}:${hit.entryId}`
      if (seen.has(key)) return
      seen.add(key)
      candidates.push(hit)
    })
  }

  for (const book of books) considerBook(book)

  if (opts.characterBook) {
    considerBook({
      id: opts.characterId ?? 'character_book',
      name: 'Character book',
      book: opts.characterBook,
      enabled: true,
    })
  }

  // Recursive: matched content can trigger more entries
  if (recursive && candidates.length) {
    let changed = true
    let guard = 0
    while (changed && guard < 5) {
      changed = false
      guard += 1
      haystack = `${haystack}\n${candidates.map((c) => c.content).join('\n')}`
      const beforeCount = candidates.length
      for (const book of books) considerBook(book)
      if (opts.characterBook) {
        considerBook({
          id: opts.characterId ?? 'character_book',
          name: 'Character book',
          book: opts.characterBook,
          enabled: true,
        })
      }
      if (candidates.length > beforeCount) changed = true
    }
  }

  candidates.sort((a, b) => b.priority - a.priority || a.label.localeCompare(b.label))

  const selected: LoreScanHit[] = []
  let used = 0
  for (const hit of candidates) {
    if (used + hit.tokens > budget && selected.length > 0) continue
    selected.push(hit)
    used += hit.tokens
  }

  const beforeChar = selected.filter((h) => h.position === 'before' || h.position === 'other')
  const afterChar = selected.filter((h) => h.position === 'after')

  return {
    beforeChar,
    afterChar,
    triggeredLabels: selected.map((h) => h.label),
  }
}

export function formatLoreSection(title: string, hits: LoreScanHit[]): string {
  if (!hits.length) return ''
  const body = hits.map((h) => h.content).join('\n\n')
  return `[${title}]\n${body}`
}

export function parseLorebookImport(raw: unknown): GlobalLorebook {
  if (!raw || typeof raw !== 'object') {
    throw new Error('Lorebook JSON is invalid.')
  }
  const obj = raw as Record<string, unknown>

  // ST world info sometimes wraps entries at root
  if (obj.entries || obj.name || obj.scan_depth != null) {
    const book = obj as LorebookBook
    return {
      id: newId('lore'),
      name: String(book.name ?? 'Imported lorebook'),
      enabled: true,
      book,
    }
  }

  if (obj.book && typeof obj.book === 'object') {
    return {
      id: String(obj.id ?? newId('lore')),
      name: String(obj.name ?? 'Lorebook'),
      enabled: obj.enabled !== false,
      book: obj.book as LorebookBook,
    }
  }

  throw new Error('Unrecognized lorebook JSON shape.')
}
