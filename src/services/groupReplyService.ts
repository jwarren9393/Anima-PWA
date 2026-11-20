import type { Character, GroupBeatPart } from '../models/types'
import type { ChatApiMessage } from './nanogpt'
import { characterSummary } from './promptBuilder'
import { flattenBeat } from './groupBeatCodec'

export type GroupBeatLine = { character: Character; text: string }

export function beatMaxTokens(speakerCount: number): number {
  const n = Math.min(8, Math.max(2, speakerCount))
  return Math.min(1400, Math.max(384, n * 160 + 128))
}

export function buildBeatMessages(opts: {
  speakers: Character[]
  allInChat: Character[]
  historyApiMessages: ChatApiMessage[]
  userName: string
  userPersona?: string
  memoryBlock?: string
  nudge?: string
  globalSystemPrompt?: string
  postHistory?: string
  priorBeatToAvoid?: string
}): ChatApiMessage[] {
  const ordered = uniqueSpeakers(opts.speakers)
  if (ordered.length < 2) return []

  const safeUser = opts.userName.trim() || 'User'
  const nameList = ordered.map((c) => c.name.trim()).join(', ')
  const formatExample = ordered
    .map((c) => `${c.name.trim()}: *brief reaction*`)
    .join('\n')

  const systemParts: string[] = [
    'You write a single coordinated group beat for private fiction.',
    'Several characters react to the SAME moment at the SAME time — quick reactions, not separate monologues.',
    `Characters in this beat (use every one, in this order): ${nameList}`,
    'Format — one line per character, exactly:',
    formatExample,
    'Rules:',
    '- Each line starts with the character name, colon, then their reaction.',
    `- You MUST write exactly ${ordered.length} lines — one for each character listed above.`,
    '- Brief only: usually one short action and/or one spoken line per character.',
    `- Do not speak as ${safeUser}.`,
    '- No numbering, bullets, titles, or commentary outside the lines.',
    '- Invent fresh reactions. Never copy an earlier group react.',
  ]

  for (const character of ordered) {
    const summary = characterSummary(character)
    if (summary) systemParts.push(`About ${character.name.trim()}:\n${summary}`)
  }

  const notSpeaking = opts.allInChat
    .filter((c) => !ordered.some((s) => s.id === c.id))
    .map((c) => c.name.trim())
    .filter(Boolean)
  if (notSpeaking.length) {
    systemParts.push(
      `Others in the chat but silent in this beat (do not write for them): ${notSpeaking.join(', ')}`,
    )
  }

  if (opts.userPersona?.trim()) {
    systemParts.push(`The user is ${safeUser}.\nPersona:\n${opts.userPersona.trim()}`)
  } else {
    systemParts.push(`The user is called ${safeUser}.`)
  }
  if (opts.globalSystemPrompt?.trim()) {
    systemParts.push(opts.globalSystemPrompt.trim())
  }

  const msgs: ChatApiMessage[] = [{ role: 'system', content: systemParts.join('\n\n') }]
  if (opts.memoryBlock?.trim()) {
    msgs.push({ role: 'system', content: opts.memoryBlock.trim() })
  }
  msgs.push(...opts.historyApiMessages)

  const user = [
    'Write a NEW group beat for the current moment — every listed character, one brief line each.',
  ]
  if (opts.priorBeatToAvoid?.trim()) {
    user.push('', 'Do NOT reuse this prior beat:', opts.priorBeatToAvoid.trim())
  }
  if (opts.nudge?.trim()) {
    user.push('', `Player nudge: ${opts.nudge.trim()}`)
  }
  msgs.push({ role: 'user', content: user.join('\n') })

  if (opts.postHistory?.trim()) {
    msgs.push({ role: 'system', content: opts.postHistory.trim() })
  }
  return msgs
}

export function parseBeatReply(raw: string, speakers: Character[]): GroupBeatLine[] {
  const ordered = uniqueSpeakers(speakers)
  if (!ordered.length) return []

  const byName = new Map<string, Character>()
  for (const c of ordered) {
    const name = c.name.trim()
    if (name) byName.set(name.toLowerCase(), c)
  }

  const out = parseBeatLinesFromText(raw, ordered, byName)
  const used = new Set(out.map((b) => b.character.id))

  for (const character of ordered) {
    if (used.has(character.id)) continue
    const extracted = extractBeatForName(raw, character.name.trim(), ordered)
    if (extracted?.trim()) {
      out.push({ character, text: extracted.trim() })
      used.add(character.id)
    }
  }

  return orderBeatsLikeSpeakers(out, ordered)
}

export function linesToBeatParts(lines: GroupBeatLine[]): GroupBeatPart[] {
  return lines.map((l) => ({
    speakerId: l.character.id,
    speakerName: l.character.name,
    text: l.text,
  }))
}

export function priorBeatAvoidText(parts: GroupBeatPart[]): string {
  return flattenBeat(parts)
}

function uniqueSpeakers(speakers: Character[]): Character[] {
  const seen = new Set<string>()
  const out: Character[] = []
  for (const c of speakers) {
    if (seen.has(c.id)) continue
    seen.add(c.id)
    out.push(c)
  }
  return out
}

function parseBeatLinesFromText(
  raw: string,
  ordered: Character[],
  byName: Map<string, Character>,
): GroupBeatLine[] {
  const lines = raw.replace(/\r\n/g, '\n').split('\n')
  const out: GroupBeatLine[] = []
  const used = new Set<string>()
  const linePattern = /^(.+?)\s*[:：\-–]\s*(.+)$/

  for (const line of lines) {
    let trimmed = line.trim()
    if (!trimmed) continue
    trimmed = trimmed.replace(/^\d+[.)]\s+/, '').replace(/^[-*•]\s+/, '')
    const match = linePattern.exec(trimmed)
    if (!match) continue
    let namePart = (match[1] ?? '').trim().replace(/[*_`]+/g, '').trim()
    const textPart = (match[2] ?? '').trim()
    if (!namePart || !textPart) continue
    const character = matchCharacter(namePart, ordered, byName)
    if (!character || used.has(character.id)) continue
    used.add(character.id)
    out.push({ character, text: textPart })
  }
  return out
}

function matchCharacter(
  namePart: string,
  ordered: Character[],
  byName: Map<string, Character>,
): Character | null {
  const lower = namePart.toLowerCase()
  const exact = byName.get(lower)
  if (exact) return exact
  for (const c of ordered) {
    const n = c.name.trim().toLowerCase()
    if (n && (lower.includes(n) || n.includes(lower))) return c
  }
  return null
}

function orderBeatsLikeSpeakers(
  beats: GroupBeatLine[],
  ordered: Character[],
): GroupBeatLine[] {
  const byId = new Map(beats.map((b) => [b.character.id, b]))
  return ordered.filter((c) => byId.has(c.id)).map((c) => byId.get(c.id)!)
}

function extractBeatForName(
  raw: string,
  name: string,
  ordered: Character[],
): string | null {
  const trimmedName = name.trim()
  if (!trimmedName) return null
  const escaped = trimmedName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const headerPattern = new RegExp(
    `(?:^|\\n)\\s*(?:[*_\`]+)?${escaped}(?:[*_\`]+)?\\s*[:：\\-–]\\s*`,
    'i',
  )
  const headerMatch = headerPattern.exec(raw)
  if (!headerMatch) return null
  let text = raw.slice(headerMatch.index + headerMatch[0].length)
  const otherNames = ordered
    .filter((c) => c.name.trim().toLowerCase() !== trimmedName.toLowerCase())
    .map((c) => c.name.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
    .filter(Boolean)
  if (otherNames.length) {
    const nextHeader = new RegExp(
      `\\n\\s*(?:[*_\`]*(?:${otherNames.join('|')})[*_\`]*\\s*[:：\\-–])`,
      'i',
    )
    const cut = nextHeader.exec(text)
    if (cut) text = text.slice(0, cut.index)
  }
  return text.trim() || null
}
