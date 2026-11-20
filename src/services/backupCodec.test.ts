import { describe, it, expect, beforeEach } from 'vitest'
import { resetDbForTests } from '../db/database'
import { API_KEY_STORAGE_KEY } from '../models/types'
import {
  AppBackupException,
  FORMAT_ID,
  decodeBackup,
  exportBackupFromDb,
  restoreBackupToDb,
} from './backupCodec'

function makeBackupBytes(overrides: Record<string, unknown> = {}): Uint8Array {
  const payload = {
    format: FORMAT_ID,
    createdAt: '2026-01-15T12:00:00.000Z',
    files: {
      'anima_characters.json': JSON.stringify([
        { id: 'c1', name: 'Aria', description: 'Traveler' },
      ]),
      'anima_personas.json': JSON.stringify([{ id: 'p1', name: 'Jay' }]),
      'anima_chats.json': JSON.stringify({
        chats: [
          {
            id: 'chat1',
            messages: [
              { id: 'm1', role: 'user', text: 'Hi' },
              { id: 'm2', role: 'assistant', text: 'Hello', swipes: ['Hello'] },
            ],
          },
        ],
        groups: [],
      }),
      'anima_lorebooks.json': JSON.stringify([
        { id: 'l1', name: 'Book', enabled: true, book: { entries: [] } },
      ]),
      'anima_character_categories.json': '[]',
      'anima_world_workshops.json': '[]',
      'anima_composer_drafts.json': '{}',
      'anima_roadway_cache.json': '{}',
      'anima_settings.json': JSON.stringify({
        favoriteModels: [{ id: 'm', name: 'Model', starredAt: '2026-01-01T00:00:00.000Z' }],
      }),
      'anima_active_persona_id.txt': 'p1',
    },
    avatars: {
      'aria.png': btoa(String.fromCharCode(137, 80, 78, 71, 1, 2, 3)),
    },
    settings: {
      chat_model_id: 'test-model',
      nanogpt_api_key: 'SHOULD_NEVER_IMPORT',
    },
    ...overrides,
  }
  return new TextEncoder().encode(JSON.stringify(payload))
}

describe('.anima-backup codec', () => {
  beforeEach(async () => {
    await resetDbForTests(`backup-${Math.random().toString(36).slice(2)}`)
  })

  it('rejects invalid format', () => {
    const bytes = new TextEncoder().encode(JSON.stringify({ format: 'nope', files: {} }))
    expect(() => decodeBackup(bytes)).toThrow(AppBackupException)
  })

  it('skips API key on decode and restores library into Dexie', async () => {
    const db = await resetDbForTests(`restore-${Math.random().toString(36).slice(2)}`)
    await db.settings.put({ key: API_KEY_STORAGE_KEY, value: 'device-local-key' })

    const summary = await restoreBackupToDb(makeBackupBytes())

    expect(summary.fileCount).toBeGreaterThan(0)
    expect(summary.characters).toBe(1)
    expect(summary.personas).toBe(1)
    expect(summary.chats).toBe(1)
    expect(summary.lorebooks).toBe(1)
    expect(summary.avatarCount).toBe(1)

    // Device-local key is preserved under the same storage key name.
    const key = await db.settings.get(API_KEY_STORAGE_KEY)
    expect(key?.value).toBe('device-local-key')

    // Backup's secret must never replace the device key.
    const allSettings = await db.settings.toArray()
    expect(allSettings.some((s) => s.value === 'SHOULD_NEVER_IMPORT')).toBe(false)

    const media = await db.media.toArray()
    expect(media).toHaveLength(1)
    expect(media[0]?.fileName).toBe('aria.png')
    expect(media[0]?.kind).toBe('avatar')
    expect(media[0]?.byteLength).toBeGreaterThan(0)
  })

  it('round-trips export → import without API key', async () => {
    const db = await resetDbForTests(`roundtrip-${Math.random().toString(36).slice(2)}`)
    await restoreBackupToDb(makeBackupBytes())
    await db.settings.put({ key: API_KEY_STORAGE_KEY, value: 'secret-never-export' })

    const bundle = await exportBackupFromDb()
    expect(bundle.json).not.toContain('secret-never-export')
    expect(bundle.json).not.toContain('SHOULD_NEVER_IMPORT')

    const decoded = decodeBackup(bundle.bytes)
    expect(decoded.settings.nanogpt_api_key).toBeUndefined()
    expect(decoded.files['anima_characters.json']).toContain('Aria')

    await resetDbForTests(`roundtrip2-${Math.random().toString(36).slice(2)}`)
    const again = await restoreBackupToDb(bundle.bytes)
    expect(again.characters).toBe(1)
    expect(again.chats).toBe(1)
  })
})
