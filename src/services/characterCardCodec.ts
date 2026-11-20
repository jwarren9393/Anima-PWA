import { newId } from '../lib/ids'
import type { Character, LorebookBook } from '../models/types'
import {
  minimalPngBytes,
  readCharaJsonFromPng,
  writeCharaJsonIntoPng,
} from './pngTextChunks'

export class CharacterCardException extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'CharacterCardException'
  }
}

function asString(v: unknown, fallback = ''): string {
  return v == null ? fallback : String(v)
}

function asStringArray(v: unknown): string[] {
  if (!Array.isArray(v)) return []
  return v.map(String)
}

/** Normalize ST V1 / V2 / V3 / Anima card JSON into an Anima Character. */
export function parseCharacterCardJson(raw: unknown, existingId?: string): Character {
  if (!raw || typeof raw !== 'object') {
    throw new CharacterCardException('Character card JSON is invalid.')
  }
  const root = raw as Record<string, unknown>

  // V2/V3 wrapper
  const data =
    root.data && typeof root.data === 'object'
      ? (root.data as Record<string, unknown>)
      : root

  // V1 sometimes uses char_name
  const name = asString(data.name ?? data.char_name ?? root.name ?? root.char_name).trim()
  if (!name) {
    throw new CharacterCardException('Character card is missing a name.')
  }

  const id =
    existingId ||
    asString(data.id ?? root.id).trim() ||
    newId('char')

  const character_book =
    data.character_book && typeof data.character_book === 'object'
      ? (data.character_book as LorebookBook)
      : null

  const character: Character = {
    id,
    name,
    description: asString(data.description),
    personality: asString(data.personality),
    scenario: asString(data.scenario),
    first_mes: asString(data.first_mes),
    alternate_greetings: asStringArray(data.alternate_greetings),
    mes_example: asString(data.mes_example),
    system_prompt: asString(data.system_prompt),
    post_history_instructions: asString(data.post_history_instructions),
    character_book,
    tags: asStringArray(data.tags),
    creator_notes: asString(data.creator_notes),
    avatarFileName:
      data.avatarFileName != null ? asString(data.avatarFileName) : null,
  }

  // Preserve useful extras without forcing them into the typed core
  for (const key of [
    'creator',
    'character_version',
    'extensions',
    'nickname',
    'group_only_greetings',
    'source',
  ]) {
    if (data[key] != null) character[key] = data[key]
  }

  return character
}

export function parseCharacterCardText(text: string, existingId?: string): Character {
  let parsed: unknown
  try {
    parsed = JSON.parse(text)
  } catch {
    throw new CharacterCardException('Character card is not valid JSON.')
  }
  return parseCharacterCardJson(parsed, existingId)
}

export function characterToStV2Json(character: Character): string {
  const data: Record<string, unknown> = {
    name: character.name,
    description: character.description ?? '',
    personality: character.personality ?? '',
    scenario: character.scenario ?? '',
    first_mes: character.first_mes ?? '',
    mes_example: character.mes_example ?? '',
    creator_notes: character.creator_notes ?? '',
    system_prompt: character.system_prompt ?? '',
    post_history_instructions: character.post_history_instructions ?? '',
    alternate_greetings: character.alternate_greetings ?? [],
    tags: character.tags ?? [],
    creator: character.creator ?? '',
    character_version: character.character_version ?? '',
    extensions: character.extensions ?? {},
  }
  if (character.character_book) {
    data.character_book = character.character_book
  }
  return JSON.stringify(
    {
      spec: 'chara_card_v2',
      spec_version: '2.0',
      data,
    },
    null,
    2,
  )
}

export function parseCharacterFromPng(bytes: Uint8Array, existingId?: string): Character {
  const jsonText = readCharaJsonFromPng(bytes)
  return parseCharacterCardText(jsonText, existingId)
}

export function exportCharacterPng(
  character: Character,
  avatarPngBytes?: Uint8Array | null,
): Uint8Array {
  const json = characterToStV2Json(character)
  const base = avatarPngBytes && avatarPngBytes.length > 8 ? avatarPngBytes : minimalPngBytes()
  return writeCharaJsonIntoPng(base, json)
}

export function downloadTextFile(filename: string, text: string, mime = 'application/json'): void {
  const blob = new Blob([text], { type: mime })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

export function downloadBytesFile(
  filename: string,
  bytes: Uint8Array,
  mime: string,
): void {
  const copy = new Uint8Array(bytes)
  const blob = new Blob([copy], { type: mime })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}
