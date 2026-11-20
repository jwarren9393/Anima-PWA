import type { ChatMessage } from '../models/types'
import type { ChatApiMessage } from './nanogpt'
import { completeChat } from './nanogpt'
import { assistantText } from './chatRepository'
import { getDb } from '../db/database'
import type { RoadwayCacheEntry } from '../models/types'

function line(m: ChatMessage): string | null {
  const text =
    m.role === 'assistant' ? assistantText(m).trim() : m.text.trim()
  if (!text || m.role === 'director') return null
  if (m.role === 'user') return `You (player): ${text}`
  if (m.role === 'narrator') return `Narrator: ${text}`
  return `Character: ${text}`
}

export function buildPathMessages(opts: {
  messages: ChatMessage[]
  count?: number
  direction?: string
}): ChatApiMessage[] {
  const n = opts.count ?? 4
  const recent = opts.messages
    .slice(-12)
    .map(line)
    .filter((x): x is string => Boolean(x))
    .join('\n')

  const directionBlock = opts.direction?.trim()
    ? [
        'The player asked for paths like this:',
        opts.direction.trim(),
        `Every option must follow that request — write ${n} variations.`,
      ].join('\n')
    : ''

  return [
    {
      role: 'system',
      content: [
        'Brainstorm short first-person options for what the PLAYER does or says next.',
        'Each option is one path the player could take.',
        'Write ONLY as the player (You): *I …* actions and "…" dialogue.',
        'Do not write the character\'s reply.',
        `Output exactly ${n} options, numbered 1-${n}, one option per number.`,
      ].join('\n'),
    },
    {
      role: 'user',
      content: [
        'Recent chat (player labeled You):',
        recent || '(empty)',
        directionBlock,
        'List the path options now.',
      ]
        .filter(Boolean)
        .join('\n\n'),
    },
  ]
}

export function normalizeUserPerspective(text: string, personaName?: string): string {
  let out = text.trim()
  if (personaName?.trim()) {
    const re = new RegExp(`\\*${personaName.trim()}([^*]*)\\*`, 'gi')
    out = out.replace(re, '*I$1*')
  }
  out = out.replace(/^\s*\d+[.)]\s*/, '').trim()
  return out
}

export function parsePathOptions(raw: string, personaName?: string): string[] {
  const lines = raw.split(/\r?\n/).map((l) => l.trim()).filter(Boolean)
  const opts: string[] = []
  for (const line of lines) {
    const m = line.match(/^\d+[.)]\s*(.+)$/)
    const body = m?.[1] ?? (/^[-*•]\s*(.+)$/.exec(line)?.[1] ?? null)
    if (!body) continue
    const normalized = normalizeUserPerspective(body, personaName)
    if (!normalized) continue
    if (opts.some((o) => o.toLowerCase() === normalized.toLowerCase())) continue
    opts.push(normalized)
  }
  // Fallback: split paragraphs if numbering failed
  if (!opts.length) {
    for (const block of raw.split(/\n{2,}/)) {
      const n = normalizeUserPerspective(block, personaName)
      if (n) opts.push(n)
    }
  }
  return opts.slice(0, 8)
}

export async function generatePaths(opts: {
  apiKey: string
  model: string
  messages: ChatMessage[]
  direction?: string
  personaName?: string
  useSubscription?: boolean
}): Promise<string[]> {
  const raw = await completeChat({
    apiKey: opts.apiKey,
    model: opts.model,
    messages: buildPathMessages({
      messages: opts.messages,
      direction: opts.direction,
    }),
    useSubscription: opts.useSubscription,
    temperature: 0.95,
    max_tokens: 700,
    frequency_penalty: 0.4,
    presence_penalty: 0.3,
  })
  return parsePathOptions(raw, opts.personaName)
}

export function buildCombineMessages(selected: string[]): ChatApiMessage[] {
  return [
    {
      role: 'system',
      content:
        'Merge the selected first-person player path options into ONE cohesive player line. Keep *actions* and "dialogue". Output only the merged line.',
    },
    {
      role: 'user',
      content: selected.map((s, i) => `${i + 1}. ${s}`).join('\n'),
    },
  ]
}

export async function combinePaths(opts: {
  apiKey: string
  model: string
  selected: string[]
  useSubscription?: boolean
}): Promise<string> {
  const raw = await completeChat({
    apiKey: opts.apiKey,
    model: opts.model,
    messages: buildCombineMessages(opts.selected),
    useSubscription: opts.useSubscription,
    temperature: 0.7,
    max_tokens: 400,
  })
  return raw.trim()
}

export async function loadRoadwayCache(
  chatId: string,
): Promise<RoadwayCacheEntry | undefined> {
  return getDb().roadwayCache.get(chatId)
}

export async function saveRoadwayCache(entry: RoadwayCacheEntry): Promise<void> {
  await getDb().roadwayCache.put(entry)
}
