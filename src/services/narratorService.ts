import type { ChatMessage } from '../models/types'
import type { ChatApiMessage } from './nanogpt'
import { completeChat } from './nanogpt'
import { assistantText } from './chatRepository'

export function cleanGeneratedOutput(text: string): string {
  return text
    .replace(/^```[\s\S]*?```/g, '')
    .replace(/^(narrator\s*[:\-–—]\s*)/i, '')
    .trim()
}

function transcriptLine(m: ChatMessage): string | null {
  const text =
    m.role === 'assistant' ? assistantText(m).trim() : m.text.trim()
  if (!text || m.role === 'director') return null
  if (m.role === 'narrator') return `Narrator: ${text}`
  if (m.role === 'user') return `You (player): ${text}`
  return `${m.speakerName || 'Character'}: ${text}`
}

/** Infer present cast names from the last N chat lines. */
export function inferPresentCast(messages: ChatMessage[], window = 10): string[] {
  const slice = messages.slice(-window)
  const names = new Set<string>()
  for (const m of slice) {
    if (m.role === 'assistant' && m.speakerName) names.add(m.speakerName)
  }
  return Array.from(names)
}

export function buildNarratorGenerateMessages(opts: {
  messages: ChatMessage[]
  characterName: string
  personaName?: string
  nudge?: string
}): ChatApiMessage[] {
  const recent = opts.messages.slice(-10)
  const older = opts.messages.slice(0, Math.max(0, opts.messages.length - 10))
  const present = inferPresentCast(opts.messages)
  if (!present.includes(opts.characterName)) present.unshift(opts.characterName)

  const currentScene = recent
    .map(transcriptLine)
    .filter((x): x is string => Boolean(x))
    .join('\n')
  const background = older
    .slice(-12)
    .map(transcriptLine)
    .filter((x): x is string => Boolean(x))
    .join('\n')

  const system = [
    'You are the omniscient Narrator for a roleplay.',
    'Write a short Narrator beat: scene law, atmosphere, or what happens in the world — not dialogue for characters unless ambient.',
    'Direct prose. No meta commentary. No markdown fences.',
    `Present cast: ${present.join(', ') || opts.characterName}`,
    opts.personaName ? `Player persona: ${opts.personaName}` : '',
  ]
    .filter(Boolean)
    .join('\n')

  const user = [
    background ? `Older background:\n${background}` : '',
    `Current scene:\n${currentScene || '(just starting)'}`,
    opts.nudge?.trim() ? `Narrator nudge from the player: ${opts.nudge.trim()}` : '',
    'Write the Narrator line now.',
  ]
    .filter(Boolean)
    .join('\n\n')

  return [
    { role: 'system', content: system },
    { role: 'user', content: user },
  ]
}

export async function generateNarratorLine(opts: {
  apiKey: string
  model: string
  messages: ChatMessage[]
  characterName: string
  personaName?: string
  nudge?: string
  useSubscription?: boolean
}): Promise<string> {
  const raw = await completeChat({
    apiKey: opts.apiKey,
    model: opts.model,
    messages: buildNarratorGenerateMessages(opts),
    useSubscription: opts.useSubscription,
    temperature: 0.85,
    max_tokens: 420,
  })
  return cleanGeneratedOutput(raw)
}

export function formatNarratorForPrompt(text: string, isLatest: boolean): string {
  const tag = isLatest ? 'Narrator (current scene law)' : 'Narrator (background)'
  return `[${tag}]\n${text.trim()}`
}
