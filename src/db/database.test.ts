import { describe, it, expect, beforeEach } from 'vitest'
import { clearAllTables, getLibraryStats, resetDbForTests } from './database'

describe('AnimaDatabase schema', () => {
  beforeEach(async () => {
    await resetDbForTests(`schema-${Math.random().toString(36).slice(2)}`)
  })

  it('creates all core tables and starts empty', async () => {
    const stats = await getLibraryStats()
    expect(stats).toEqual({
      characters: 0,
      personas: 0,
      lorebooks: 0,
      chats: 0,
      workshops: 0,
      media: 0,
    })
  })

  it('stores characters, chats with roles, and settings', async () => {
    const db = await resetDbForTests(`data-${Math.random().toString(36).slice(2)}`)

    await db.characters.put({
      id: 'c1',
      name: 'Aria',
      description: 'A traveler',
    })
    await db.personas.put({ id: 'p1', name: 'Jay' })
    await db.chatSessions.put({
      id: 'chat1',
      messages: [
        { id: 'm1', role: 'user', text: 'Hello' },
        { id: 'm2', role: 'assistant', text: 'Hi', swipes: ['Hi', 'Hey'], swipeIndex: 0 },
        { id: 'm3', role: 'narrator', text: 'Rain begins.' },
        { id: 'm4', role: 'director', text: 'Keep it tense.' },
      ],
      updatedAt: new Date().toISOString(),
    })
    await db.lorebooks.put({
      id: 'l1',
      name: 'World',
      enabled: true,
      book: { entries: [] },
    })
    await db.settings.put({ key: 'chat_model_id', value: 'test-model' })
    await db.favoriteModels.put({
      id: 'test-model',
      name: 'Test',
      starredAt: new Date().toISOString(),
    })
    await db.composerDrafts.put({
      chatId: 'chat1',
      text: 'draft',
      updatedAt: new Date().toISOString(),
    })
    await db.roadwayCache.put({
      chatId: 'chat1',
      options: ['A', 'B'],
      updatedAt: new Date().toISOString(),
    })
    await db.media.put({
      id: 'avatar:a.png',
      fileName: 'a.png',
      kind: 'avatar',
      mimeType: 'image/png',
      data: new Uint8Array([1, 2, 3]).buffer,
      byteLength: 3,
      updatedAt: new Date().toISOString(),
    })

    const stats = await getLibraryStats()
    expect(stats.characters).toBe(1)
    expect(stats.personas).toBe(1)
    expect(stats.chats).toBe(1)
    expect(stats.lorebooks).toBe(1)
    expect(stats.media).toBe(1)

    const chat = await db.chatSessions.get('chat1')
    expect(chat?.messages.map((m) => m.role)).toEqual([
      'user',
      'assistant',
      'narrator',
      'director',
    ])

    await clearAllTables(db)
    expect(await getLibraryStats()).toEqual({
      characters: 0,
      personas: 0,
      lorebooks: 0,
      chats: 0,
      workshops: 0,
      media: 0,
    })
  })
})
