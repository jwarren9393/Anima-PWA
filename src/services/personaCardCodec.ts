import { newId } from '../lib/ids'
import type { Persona } from '../models/types'

export class PersonaCardException extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'PersonaCardException'
  }
}

function asString(v: unknown, fallback = ''): string {
  return v == null ? fallback : String(v)
}

/** Accept Anima persona JSON, AI-written cards, aliases, or list wrappers. */
export function parsePersonaCardJson(raw: unknown, existingId?: string): Persona {
  if (!raw || typeof raw !== 'object') {
    throw new PersonaCardException('Persona JSON is invalid.')
  }

  let obj = raw as Record<string, unknown>
  if (Array.isArray(raw)) {
    if (!raw.length) throw new PersonaCardException('Persona list is empty.')
    obj = (raw[0] && typeof raw[0] === 'object' ? raw[0] : {}) as Record<string, unknown>
  } else if (Array.isArray(obj.personas) && obj.personas[0]) {
    obj = obj.personas[0] as Record<string, unknown>
  } else if (obj.data && typeof obj.data === 'object') {
    obj = obj.data as Record<string, unknown>
  }

  const name = asString(obj.name ?? obj.persona_name).trim()
  if (!name) throw new PersonaCardException('Persona is missing a name.')

  const identity = asString(
    obj.identity ?? obj.role ?? (obj as { looks?: unknown }).looks,
  )
  const appearance = asString(obj.appearance ?? obj.looks)
  const personality = asString(obj.personality)
  const background = asString(obj.background ?? obj.backstory)
  const goals = asString(obj.goals ?? obj.motivations)

  return {
    id: existingId || asString(obj.id).trim() || newId('persona'),
    name,
    identity: identity || asString(obj.identity),
    role: asString(obj.role),
    appearance,
    personality,
    background,
    goals,
    avatarFileName: obj.avatarFileName != null ? asString(obj.avatarFileName) : null,
    promptText: asString(obj.promptText),
  }
}

export function parsePersonaCardText(text: string, existingId?: string): Persona {
  let parsed: unknown
  try {
    parsed = JSON.parse(text)
  } catch {
    throw new PersonaCardException('Persona file is not valid JSON.')
  }
  return parsePersonaCardJson(parsed, existingId)
}

export function personaToJson(persona: Persona): string {
  return JSON.stringify(
    {
      id: persona.id,
      name: persona.name,
      identity: persona.identity ?? '',
      role: persona.role ?? '',
      appearance: persona.appearance ?? '',
      personality: persona.personality ?? '',
      background: persona.background ?? '',
      goals: persona.goals ?? '',
      avatarFileName: persona.avatarFileName ?? null,
      promptText: persona.promptText ?? '',
    },
    null,
    2,
  )
}

export function formatPersonaPromptBlock(persona: Persona): string {
  if (persona.promptText?.trim()) return persona.promptText.trim()

  const lines: string[] = [`{{user}} persona — ${persona.name}`]
  const fields: Array<[string, string | undefined]> = [
    ['Identity / role', persona.identity || persona.role],
    ['Appearance', persona.appearance],
    ['Personality', persona.personality],
    ['Background', persona.background],
    ['Goals', persona.goals],
  ]
  for (const [label, value] of fields) {
    if (value?.trim()) lines.push(`${label}: ${value.trim()}`)
  }
  return lines.join('\n')
}
