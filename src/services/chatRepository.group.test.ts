import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it } from 'vitest'
import { resetDbForTests } from '../db/database'
import type { Character } from '../models/types'
import { upsertCharacter } from './libraryRepository'
import {
  createGroupChat,
  GROUPS_KEY,
  listAllChats,
  updateSessionCast,
} from './chatRepository'

function char(id: string, name: string): Character {
  return {
    id,
    name,
    first_mes: `*${name} waves.* "Hi."`,
    description: `${name} description`,
    personality: 'friendly',
  }
}

describe('group chat repository', () => {
  beforeEach(async () => {
    await resetDbForTests(`group-${Math.random().toString(36).slice(2)}`)
  })

  it('creates a group with greeting from first member', async () => {
    const a = char('a', 'Ada')
    const b = char('b', 'Bea')
    await upsertCharacter(a)
    await upsertCharacter(b)
    const session = await createGroupChat({ members: [a, b] })
    expect(session.isGroup).toBe(true)
    expect(session.characterId).toBe(GROUPS_KEY)
    expect(session.participantIds).toEqual(['a', 'b'])
    expect(session.messages[0]?.speakerId).toBe('a')
    expect(session.messages[0]?.text).toContain('Ada')
    const listed = await listAllChats()
    expect(listed.some((c) => c.id === session.id)).toBe(true)
  })

  it('rejects fewer than two members', async () => {
    await expect(createGroupChat({ members: [char('a', 'Ada')] })).rejects.toThrow(
      /at least two/i,
    )
  })

  it('updateSessionCast records newcomers and can shrink to solo', async () => {
    const a = char('a', 'Ada')
    const b = char('b', 'Bea')
    const c = char('c', 'Cia')
    await upsertCharacter(a)
    await upsertCharacter(b)
    await upsertCharacter(c)
    const session = await createGroupChat({ members: [a, b] })
    const withCia = await updateSessionCast(session, [a, b, c])
    expect(withCia.participantIds).toEqual(['a', 'b', 'c'])
    expect(withCia.castJoinedAt?.c).toBe(session.messages.length)

    const solo = await updateSessionCast(withCia, [b])
    expect(solo.isGroup).toBe(false)
    expect(solo.characterId).toBe('b')
    expect(solo.participantIds).toBeUndefined()
  })
})
