import { getDb } from '../db/database'
import { newId } from '../lib/ids'
import { applyMacros } from '../lib/macros'
import type { Character, ChatMessage, ChatSession, Persona } from '../models/types'
import { openingGreeting } from './promptBuilder'
import { ACTIVE_PERSONA_ID_KEY } from '../models/types'
import { getSetting } from './settingsStore'

/** Storage bucket id for multi-character group chats (mirrors Flutter). */
export const GROUPS_KEY = '__groups__'

export function defaultGroupTitle(memberCount: number): string {
  return `Group chat (${memberCount})`
}

function sortByUpdated(a: ChatSession, b: ChatSession): number {
  return String(b.updatedAt ?? '').localeCompare(String(a.updatedAt ?? ''))
}

export async function listSoloChats(): Promise<ChatSession[]> {
  const all = await getDb().chatSessions.toArray()
  return all.filter((c) => !c.isGroup).sort(sortByUpdated)
}

export async function listGroupChats(): Promise<ChatSession[]> {
  const all = await getDb().chatSessions.toArray()
  return all.filter((c) => c.isGroup || (c.participantIds?.length ?? 0) > 1).sort(sortByUpdated)
}

/** Solo + group chats for the Home journal. */
export async function listAllChats(): Promise<ChatSession[]> {
  const all = await getDb().chatSessions.toArray()
  return all.sort(sortByUpdated)
}

export async function getChat(id: string): Promise<ChatSession | undefined> {
  return getDb().chatSessions.get(id)
}

export async function saveChat(session: ChatSession): Promise<void> {
  await getDb().chatSessions.put({
    ...session,
    updatedAt: new Date().toISOString(),
  })
}

export async function deleteChat(id: string): Promise<void> {
  const db = getDb()
  await db.transaction('rw', db.chatSessions, db.composerDrafts, db.roadwayCache, async () => {
    await db.chatSessions.delete(id)
    await db.composerDrafts.delete(id)
    await db.roadwayCache.delete(id)
  })
}

export async function createSoloChat(opts: {
  character: Character
  persona?: Persona | null
  greetingIndex?: number
}): Promise<ChatSession> {
  const personaId =
    opts.persona?.id ??
    (await getSetting(ACTIVE_PERSONA_ID_KEY)) ??
    null

  const greeting = openingGreeting(opts.character, opts.greetingIndex ?? 0)
  const now = new Date().toISOString()
  const session: ChatSession = {
    id: newId('chat'),
    title: opts.character.name,
    characterId: opts.character.id,
    personaId,
    messages: [
      {
        id: newId('msg'),
        role: 'assistant',
        text: greeting,
        swipes: [greeting],
        swipeIndex: 0,
        createdAt: now,
      },
    ],
    autoReply: false,
    createdAt: now,
    updatedAt: now,
    isGroup: false,
  }
  await saveChat(session)
  return session
}

export async function createGroupChat(opts: {
  members: Character[]
  persona?: Persona | null
  authorsNote?: string
  autoReply?: boolean
  lorebookIds?: string[] | null
  title?: string
  greetingIndex?: number
}): Promise<ChatSession> {
  if (opts.members.length < 2) {
    throw new Error('Group chats need at least two characters.')
  }
  const personaId =
    opts.persona?.id ?? (await getSetting(ACTIVE_PERSONA_ID_KEY)) ?? null
  const userName = opts.persona?.name?.trim() || 'User'
  const first = opts.members[0]!
  const rawGreeting = openingGreeting(first, opts.greetingIndex ?? 0)
  const greeting = applyMacros(rawGreeting, {
    userName,
    charName: first.name,
  })
  const now = new Date().toISOString()
  const messages: ChatMessage[] = greeting.trim()
    ? [
        {
          id: newId('msg'),
          role: 'assistant',
          text: greeting,
          swipes: [greeting],
          swipeIndex: 0,
          speakerId: first.id,
          speakerName: first.name,
          createdAt: now,
        },
      ]
    : []

  const session: ChatSession = {
    id: newId('chat'),
    title: opts.title?.trim() || defaultGroupTitle(opts.members.length),
    characterId: GROUPS_KEY,
    personaId,
    messages,
    authorsNote: opts.authorsNote?.trim() || undefined,
    participantIds: opts.members.map((m) => m.id),
    nextSpeakerIndex: messages.length ? 1 % opts.members.length : 0,
    autoReply: opts.autoReply ?? false,
    lorebookIds: opts.lorebookIds ?? null,
    castJoinedAt: Object.fromEntries(opts.members.map((m) => [m.id, 0])),
    createdAt: now,
    updatedAt: now,
    isGroup: true,
  }
  await saveChat(session)
  return session
}

/**
 * Update cast order/membership. 2+ → group bucket; 1 → solo under that character.
 * Newcomers get `castJoinedAt[id] = messages.length`.
 */
export async function updateSessionCast(
  session: ChatSession,
  orderedMembers: Character[],
  opts: {
    authorsNote?: string
    autoReply?: boolean
    lorebookIds?: string[] | null
    title?: string
  } = {},
): Promise<ChatSession> {
  if (orderedMembers.length === 0) {
    throw new Error('A chat needs at least one character.')
  }
  const orderedIds = orderedMembers.map((m) => m.id)
  const willBeGroup = orderedIds.length > 1
  const priorIds = session.participantIds?.length
    ? session.participantIds
    : session.characterId && session.characterId !== GROUPS_KEY
      ? [session.characterId]
      : []

  let nextSpeakerIndex = session.nextSpeakerIndex ?? 0
  if (!willBeGroup) {
    nextSpeakerIndex = 0
  } else if (priorIds.length && nextSpeakerIndex >= 0 && nextSpeakerIndex < priorIds.length) {
    const currentId = priorIds[nextSpeakerIndex]!
    const idx = orderedIds.indexOf(currentId)
    nextSpeakerIndex = idx >= 0 ? idx : 0
  } else {
    nextSpeakerIndex = Math.min(Math.max(0, nextSpeakerIndex), orderedIds.length - 1)
  }

  let nextTitle = session.title
  if (opts.title?.trim()) {
    nextTitle = opts.title.trim()
  } else if (willBeGroup && !session.isGroup) {
    nextTitle = defaultGroupTitle(orderedIds.length)
  } else if (willBeGroup) {
    nextTitle = nextTitle || defaultGroupTitle(orderedIds.length)
  } else {
    nextTitle = orderedMembers[0]!.name
  }

  const priorSet = new Set(priorIds)
  const nextJoined: Record<string, number> = { ...(session.castJoinedAt ?? {}) }
  for (const id of Object.keys(nextJoined)) {
    if (!orderedIds.includes(id)) delete nextJoined[id]
  }
  for (const id of orderedIds) {
    if (!priorSet.has(id) && nextJoined[id] === undefined) {
      nextJoined[id] = session.messages.length
    }
  }

  const updated: ChatSession = {
    ...session,
    characterId: willBeGroup ? GROUPS_KEY : orderedMembers[0]!.id,
    participantIds: willBeGroup ? orderedIds : undefined,
    isGroup: willBeGroup,
    nextSpeakerIndex,
    title: nextTitle,
    authorsNote: opts.authorsNote !== undefined ? opts.authorsNote : session.authorsNote,
    autoReply: opts.autoReply ?? session.autoReply,
    lorebookIds: opts.lorebookIds !== undefined ? opts.lorebookIds : session.lorebookIds,
    castJoinedAt: nextJoined,
  }
  await saveChat(updated)
  return updated
}

export function assistantText(message: ChatMessage): string {
  if (message.swipes?.length) {
    return message.swipes[message.swipeIndex ?? 0] ?? message.text
  }
  return message.text
}

export function withAssistantText(message: ChatMessage, text: string): ChatMessage {
  const swipes = [...(message.swipes?.length ? message.swipes : [message.text])]
  const idx = message.swipeIndex ?? Math.max(0, swipes.length - 1)
  swipes[idx] = text
  return { ...message, text, swipes, swipeIndex: idx }
}

export function addAssistantSwipe(message: ChatMessage, text: string): ChatMessage {
  const swipes = [...(message.swipes?.length ? message.swipes : [message.text]), text]
  return {
    ...message,
    text,
    swipes,
    swipeIndex: swipes.length - 1,
  }
}

/** Delete message and everything after it. */
export function rewindToMessage(session: ChatSession, messageId: string): ChatSession {
  const idx = session.messages.findIndex((m) => m.id === messageId)
  if (idx < 0) return session
  return {
    ...session,
    messages: session.messages.slice(0, idx + 1),
  }
}

/** Branch: rewind to message, then duplicate session as a new chat. */
export async function branchFromMessage(
  session: ChatSession,
  messageId: string,
): Promise<ChatSession> {
  const rewound = rewindToMessage(session, messageId)
  const branched: ChatSession = {
    ...rewound,
    id: newId('chat'),
    title: `${session.title ?? session.name ?? 'Chat'} (branch)`,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    messages: rewound.messages.map((m) => ({ ...m, id: newId('msg') })),
  }
  await saveChat(branched)
  return branched
}

export async function getComposerDraft(chatId: string): Promise<string> {
  const row = await getDb().composerDrafts.get(chatId)
  return row?.text ?? ''
}

export async function setComposerDraft(chatId: string, text: string): Promise<void> {
  if (!text.trim()) {
    await getDb().composerDrafts.delete(chatId)
    return
  }
  await getDb().composerDrafts.put({
    chatId,
    text,
    updatedAt: new Date().toISOString(),
  })
}
