import type { Character, ChatMessage } from '../models/types'

/**
 * Picks who should speak next in a manual group chat (no round-robin).
 * Mirrors Flutter `GroupSpeakerInference`.
 */
export function resolveGroupSpeaker(opts: {
  participants: Character[]
  messages: ChatMessage[]
  primaryCharacter?: Character | null
}): Character {
  const { participants, messages, primaryCharacter } = opts
  if (!participants.length) {
    return (
      primaryCharacter ?? {
        id: 'unknown',
        name: 'Character',
      }
    )
  }
  if (!messages.length) {
    return primaryCharacter ?? participants[0]!
  }

  const last = messages[messages.length - 1]!

  if (last.role === 'assistant') {
    const fromMessage = fromMessageSpeaker(last, participants)
    if (fromMessage) return fromMessage
  }

  if (last.role === 'user') {
    const mentioned = mentionedInText(last.text, participants)
    if (mentioned) return mentioned

    for (let i = messages.length - 2; i >= 0; i--) {
      const m = messages[i]!
      if (m.role === 'assistant') {
        const fromMessage = fromMessageSpeaker(m, participants)
        if (fromMessage) return fromMessage
      }
      if (m.role === 'groupBeat') break
    }
  }

  if (last.role === 'groupBeat' && last.beatLines?.length) {
    const lastLine = last.beatLines[last.beatLines.length - 1]!
    const fromLine = fromMessageSpeaker(
      {
        id: 'infer',
        role: 'assistant',
        text: lastLine.text,
        speakerId: lastLine.speakerId,
        speakerName: lastLine.speakerName,
      },
      participants,
    )
    if (fromLine) return fromLine
  }

  if (
    primaryCharacter &&
    participants.some((c) => c.id === primaryCharacter.id)
  ) {
    return primaryCharacter
  }
  return participants[0]!
}

function fromMessageSpeaker(
  message: ChatMessage,
  participants: Character[],
): Character | null {
  const id = message.speakerId?.trim() ?? ''
  if (id) {
    for (const c of participants) {
      if (c.id === id) return c
    }
  }
  const name = message.speakerName?.trim() ?? ''
  if (name) {
    const lower = name.toLowerCase()
    for (const c of participants) {
      if (c.name.trim().toLowerCase() === lower) return c
    }
  }
  return null
}

function mentionedInText(text: string, participants: Character[]): Character | null {
  const lower = text.toLowerCase()
  let best: Character | null = null
  let bestLen = 0
  for (const c of participants) {
    const name = c.name.trim()
    if (!name) continue
    const nLower = name.toLowerCase()
    if (lower.includes(nLower) && nLower.length > bestLen) {
      best = c
      bestLen = nLower.length
    }
  }
  return best
}

/** Late user nudge when the last visible line was another cast member. */
export function buildHandoffNudge(opts: {
  messages: ChatMessage[]
  endExclusive: number
  target: Character
}): { role: 'user'; content: string } | null {
  const { messages, endExclusive, target } = opts
  if (endExclusive <= 0 || endExclusive > messages.length) return null
  const last = messages[endExclusive - 1]!
  const targetName = target.name.trim() || 'Character'

  if (last.role === 'user') return null

  if (last.role === 'assistant') {
    const id = last.speakerId?.trim() ?? ''
    if (id && id === target.id) return null
    const name = last.speakerName?.trim() ?? ''
    if (name && name.toLowerCase() === targetName.toLowerCase()) return null
    const prev = name || 'Another character'
    return {
      role: 'user',
      content:
        `(${prev} just spoke. Write ONLY ${targetName}'s next reply now — ` +
        `in ${targetName}'s voice, first person (*I* actions, "dialogue"). ` +
        `Do not continue as ${prev} or any other cast member. Do not speak ` +
        `for the user. Do not prefix your reply with "${targetName}:" — ` +
        `the app labels the speaker.)`,
    }
  }

  return null
}

/** Advance round-robin cursor after an auto-reply turn. */
export function advanceSpeakerIndex(
  current: number,
  participantCount: number,
): number {
  if (participantCount <= 0) return 0
  return (current + 1) % participantCount
}
