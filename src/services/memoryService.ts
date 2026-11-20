import type { ChatMessage, ChatSession } from '../models/types'
import type { ChatApiMessage } from './nanogpt'
import { completeChat } from './nanogpt'
import {
  MEMORY_SUMMARIZE_SYSTEM,
  finalizeSummarizeOutput,
  formatMemorySummary,
  parseMemorySummary,
} from './memorySummary'
import { assistantText } from './chatRepository'

export function messagesSinceMemory(session: ChatSession): number {
  const covered = session.memoryCoveredCount ?? 0
  return Math.max(0, session.messages.length - covered)
}

export function shouldAutoSummarize(
  session: ChatSession,
  everyN: number,
): boolean {
  if (!everyN || everyN < 1) return false
  return messagesSinceMemory(session) >= everyN
}

function lineForSummary(m: ChatMessage): string | null {
  const text =
    m.role === 'assistant' ? assistantText(m).trim() : m.text.trim()
  if (!text) return null
  if (m.role === 'director') return null
  const who =
    m.role === 'user'
      ? 'You (player)'
      : m.role === 'narrator'
        ? 'Narrator'
        : m.speakerName || 'Character'
  return `${who}: ${text}`
}

export function buildSummarizeMessages(
  session: ChatSession,
  opts: { keepRecentRaw?: number } = {},
): ChatApiMessage[] {
  const keep = opts.keepRecentRaw ?? 8
  const covered = session.memoryCoveredCount ?? 0
  const foldEnd = Math.max(covered, session.messages.length - keep)
  const chunk = session.messages.slice(covered, foldEnd)
  const transcript = chunk
    .map(lineForSummary)
    .filter((x): x is string => Boolean(x))
    .join('\n')

  const previous = session.memorySummary?.trim()
    ? session.memorySummary.trim()
    : '(empty)'

  return [
    { role: 'system', content: MEMORY_SUMMARIZE_SYSTEM },
    {
      role: 'user',
      content: [
        'Previous memory document:',
        previous,
        '',
        'New chat chunk to fold in:',
        transcript || '(no new lines)',
        '',
        'Return the updated ## Scene and ## Ledger document only.',
      ].join('\n'),
    },
  ]
}

export async function summarizeSessionMemory(opts: {
  session: ChatSession
  apiKey: string
  model: string
  useSubscription?: boolean
  keepRecentRaw?: number
}): Promise<ChatSession> {
  const keep = opts.keepRecentRaw ?? 8
  const covered = opts.session.memoryCoveredCount ?? 0
  const foldEnd = Math.max(covered, opts.session.messages.length - keep)
  if (foldEnd <= covered) {
    return opts.session
  }

  const messages = buildSummarizeMessages(opts.session, { keepRecentRaw: keep })
  const output = await completeChat({
    apiKey: opts.apiKey,
    model: opts.model,
    messages,
    useSubscription: opts.useSubscription,
    temperature: 0.2,
    max_tokens: 2048,
  })

  if (!output.trim()) {
    // Empty model output must not advance covered count
    return opts.session
  }

  const previous = parseMemorySummary(opts.session.memorySummary)
  const finalized = finalizeSummarizeOutput(output, previous)

  return {
    ...opts.session,
    memorySummary: finalized,
    memoryCoveredCount: foldEnd,
  }
}

export function memoryChipLabel(session: ChatSession): string | null {
  const doc = parseMemorySummary(session.memorySummary)
  const n = doc.scene.length + doc.ledger.length
  if (!n) return null
  return `Memory (${n})`
}

export { formatMemorySummary, parseMemorySummary }
