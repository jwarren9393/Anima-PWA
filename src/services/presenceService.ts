import type { ChatMessage } from '../models/types'
import { activeBeatLines, flattenBeat } from './groupBeatCodec'
import { assistantText } from './chatRepository'

export const KNOWLEDGE_BOUNDARY = `Knowledge boundaries (absolute — never break these):
- You are {{char}}. You ONLY know what {{char}} personally witnessed in-scene or was told directly while present.
- Chat history below is filtered to {{char}}'s knowledge — scenes {{char}} missed are omitted.
- If something is missing from history, {{char}} does NOT know it — do not guess or invent awareness.
- Other character summaries in the system prompt are identity reference only — not shared knowledge.
- Narrator establishes who is present — honor that. Do not speak for {{user}}.`

export function formatKnowledgeBoundary(charName: string, userName: string): string {
  return KNOWLEDGE_BOUNDARY.replace(/\{\{char\}\}/g, charName.trim() || 'Character').replace(
    /\{\{user\}\}/g,
    userName.trim() || 'User',
  )
}

/** Drop messages before the character joined (by message index count). */
export function filterHistoryForJoin(
  history: ChatMessage[],
  joinedAtMessageCount: number,
): ChatMessage[] {
  if (joinedAtMessageCount <= 0) return history
  // History may already be a slice of allMessages; filter by absolute index via created order.
  // Callers pass messages already sliced from join — this helper slices from index.
  return history.slice(Math.min(joinedAtMessageCount, history.length))
}

export function filterMessagesFromJoinIndex(
  allMessages: ChatMessage[],
  joinedAtMessageCount: number,
): ChatMessage[] {
  if (joinedAtMessageCount <= 0) return allMessages
  return allMessages.slice(Math.min(joinedAtMessageCount, allMessages.length))
}

/** ~5 pre-join snippets for late joiners. */
export function buildCatchUpBlock(opts: {
  messages: ChatMessage[]
  joinIndex: number
  userName: string
}): string {
  const { messages, joinIndex, userName } = opts
  if (joinIndex <= 0) return ''
  const start = Math.max(0, joinIndex - 5)
  if (start >= joinIndex) return ''
  const snippets: string[] = []
  for (let i = start; i < joinIndex; i++) {
    const msg = messages[i]!
    if (msg.role === 'director') continue
    if (msg.role === 'narrator' && msg.text.trim()) {
      snippets.push(`[Setting: ${msg.text.trim()}]`)
      continue
    }
    if (msg.role === 'groupBeat') {
      const lines = activeBeatLines(msg)
      const flat = flattenBeat(lines)
      if (flat) {
        for (const line of flat.split('\n')) snippets.push(line)
      }
      continue
    }
    if (msg.role === 'user' && msg.text.trim()) {
      snippets.push(`${userName}: ${msg.text.trim()}`)
    } else if (msg.role === 'assistant') {
      const body = assistantText(msg).trim()
      if (!body) continue
      if (msg.speakerName?.trim()) snippets.push(`${msg.speakerName}: ${body}`)
      else snippets.push(body)
    }
  }
  if (!snippets.length) return ''
  return `You just entered the scene. From what you can see and hear:\n${snippets.join('\n')}`
}

export function joinIndexFor(
  castJoinedAt: Record<string, number> | undefined,
  characterId: string,
): number {
  return castJoinedAt?.[characterId] ?? 0
}
