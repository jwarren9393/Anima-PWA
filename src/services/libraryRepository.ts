import { getDb } from '../db/database'
import { newId } from '../lib/ids'
import type { Character, GlobalLorebook, Persona } from '../models/types'
import { ACTIVE_PERSONA_ID_KEY } from '../models/types'
import { getSetting, setSetting } from './settingsStore'

export async function listCharacters(): Promise<Character[]> {
  const rows = await getDb().characters.toArray()
  return rows.sort((a, b) => a.name.localeCompare(b.name))
}

export async function getCharacter(id: string): Promise<Character | undefined> {
  return getDb().characters.get(id)
}

export async function upsertCharacter(character: Character): Promise<void> {
  await getDb().characters.put(character)
}

export async function deleteCharacter(id: string): Promise<void> {
  await getDb().characters.delete(id)
}

export function blankCharacter(): Character {
  return {
    id: newId('char'),
    name: '',
    description: '',
    personality: '',
    scenario: '',
    first_mes: '',
    alternate_greetings: [],
    mes_example: '',
    system_prompt: '',
    post_history_instructions: '',
    character_book: null,
    avatarFileName: null,
    tags: [],
    creator_notes: '',
  }
}

export async function listPersonas(): Promise<Persona[]> {
  const rows = await getDb().personas.toArray()
  return rows.sort((a, b) => a.name.localeCompare(b.name))
}

export async function getPersona(id: string): Promise<Persona | undefined> {
  return getDb().personas.get(id)
}

export async function upsertPersona(persona: Persona): Promise<void> {
  await getDb().personas.put(persona)
}

export async function deletePersona(id: string): Promise<void> {
  await getDb().personas.delete(id)
  const active = await getSetting(ACTIVE_PERSONA_ID_KEY)
  if (active === id) await setSetting(ACTIVE_PERSONA_ID_KEY, '')
}

export function blankPersona(): Persona {
  return {
    id: newId('persona'),
    name: '',
    identity: '',
    role: '',
    appearance: '',
    personality: '',
    background: '',
    goals: '',
    avatarFileName: null,
    promptText: '',
  }
}

export async function getActivePersonaId(): Promise<string | null> {
  const id = await getSetting(ACTIVE_PERSONA_ID_KEY)
  return id?.trim() ? id : null
}

export async function setActivePersonaId(id: string | null): Promise<void> {
  await setSetting(ACTIVE_PERSONA_ID_KEY, id ?? '')
}

export async function listLorebooks(): Promise<GlobalLorebook[]> {
  const rows = await getDb().lorebooks.toArray()
  return rows.sort((a, b) => a.name.localeCompare(b.name))
}

export async function upsertLorebook(book: GlobalLorebook): Promise<void> {
  await getDb().lorebooks.put(book)
}

export async function deleteLorebook(id: string): Promise<void> {
  await getDb().lorebooks.delete(id)
}

export function blankLorebook(): GlobalLorebook {
  return {
    id: newId('lore'),
    name: 'New lorebook',
    enabled: true,
    book: {
      name: 'New lorebook',
      scan_depth: 4,
      token_budget: 512,
      recursive_scanning: false,
      entries: [],
    },
  }
}
