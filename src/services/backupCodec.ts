/**
 * `.anima-backup` codec — mirrors docs/legacy/LEGACY_BACKUP_CODEC.dart
 * format `anima_backup_v1`. API keys are never imported or exported.
 */

import { getDb, type AnimaDatabase } from '../db/database'
import {
  ACTIVE_PERSONA_ID_KEY,
  API_KEY_STORAGE_KEY,
  FAVORITE_MODELS_KEY,
  type Character,
  type CharacterCategory,
  type ChatSession,
  type ComposerDraft,
  type FavoriteModel,
  type GlobalLorebook,
  type MediaBlob,
  type Persona,
  type RoadwayCacheEntry,
  type WorldWorkshop,
} from '../models/types'

export const FORMAT_ID = 'anima_backup_v1'
export const FILE_EXTENSION = 'anima-backup'

export const DOCUMENT_FILE_NAMES = [
  'anima_characters.json',
  'anima_chats.json',
  'anima_personas.json',
  'anima_character_categories.json',
  'anima_lorebooks.json',
  'anima_world_workshops.json',
  'anima_composer_drafts.json',
  'anima_roadway_cache.json',
  'anima_settings.json',
  'anima_active_persona_id.txt',
] as const

const MAX_AVATAR_BYTES = 8 * 1024 * 1024
const MAX_AVATAR_COUNT = 200
const MAX_JSON_FILE_BYTES = 40 * 1024 * 1024

/** Preference keys known from the Flutter SettingsService backup whitelist + PWA additions. */
export const BACKUP_PREFERENCE_KEYS = new Set<string>([
  ACTIVE_PERSONA_ID_KEY,
  'chat_model_id',
  'image_model_id',
  'use_subscription_endpoint',
  'temperature',
  'top_p',
  'max_tokens',
  'frequency_penalty',
  'presence_penalty',
  'repetition_penalty',
  'favorite_models',
  'global_system_prompt',
  'global_post_history',
  'auto_summarize_every',
  'wand_guidance',
  'auto_wrap_dialogue',
  'enter_to_send',
  'roadway_note',
  'narrator_note',
  'ui_style_settings',
  'chat_experience_settings',
  'sampling_settings',
  'collaborator_settings',
  'character_build_settings',
  'lore_scan_depth',
  'lore_token_budget',
  'lore_recursive_scan',
  'theme_palette',
  'appearance_settings',
])

export class AppBackupException extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'AppBackupException'
  }
}

export interface AppBackupSummary {
  createdAt: string
  fileCount: number
  avatarCount: number
  settingsCount: number
  worldFileCount: number
  /** Extra counts after IndexedDB restore */
  characters?: number
  personas?: number
  chats?: number
  lorebooks?: number
  workshops?: number
}

export interface AppBackupPayload {
  files: Record<string, string>
  avatars: Record<string, Uint8Array>
  chatBackgrounds: Record<string, Uint8Array>
  worlds: Record<string, string>
  settings: Record<string, string>
  summary: AppBackupSummary
}

export interface AppBackupBundle {
  json: string
  bytes: Uint8List
  summary: AppBackupSummary
}

type Uint8List = Uint8Array

function utf8ByteLength(text: string): number {
  return new TextEncoder().encode(text).length
}

function isAllowedDocumentName(name: string): boolean {
  if (name.includes('/') || name.includes('\\') || name.includes('..')) {
    return false
  }
  return (DOCUMENT_FILE_NAMES as readonly string[]).includes(name)
}

function isSafeImageFileName(name: string): boolean {
  if (!name || name.includes('..') || name.includes('/') || name.includes('\\')) {
    return false
  }
  return /^[\w.-]+$/.test(name)
}

function isSafeWorldFileName(name: string): boolean {
  return isSafeImageFileName(name) && name.toLowerCase().endsWith('.json')
}

function isAllowedPreferenceKey(key: string): boolean {
  if (key === ACTIVE_PERSONA_ID_KEY) return true
  if (BACKUP_PREFERENCE_KEYS.has(key)) return true
  // Forward-compatible: allow boring alphanumeric keys from newer Flutter builds.
  if (/^[a-z][a-z0-9_]*$/i.test(key) && !/api_?key|secret|password|token/i.test(key)) {
    return true
  }
  return false
}

function mimeFromFileName(name: string): string {
  const lower = name.toLowerCase()
  if (lower.endsWith('.png')) return 'image/png'
  if (lower.endsWith('.jpg') || lower.endsWith('.jpeg')) return 'image/jpeg'
  if (lower.endsWith('.webp')) return 'image/webp'
  if (lower.endsWith('.gif')) return 'image/gif'
  return 'application/octet-stream'
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = ''
  const chunk = 0x8000
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk))
  }
  return btoa(binary)
}

function base64ToBytes(b64: string): Uint8Array {
  const binary = atob(b64)
  const out = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) {
    out[i] = binary.charCodeAt(i)
  }
  return out
}

export function shortDescription(summary: AppBackupSummary): string {
  const parts = [
    `${summary.fileCount} data file${summary.fileCount === 1 ? '' : 's'}`,
    `${summary.avatarCount} avatar${summary.avatarCount === 1 ? '' : 's'}`,
    `${summary.settingsCount} setting${summary.settingsCount === 1 ? '' : 's'}`,
  ]
  if (summary.worldFileCount > 0) {
    parts.push(
      `${summary.worldFileCount} world file${summary.worldFileCount === 1 ? '' : 's'}`,
    )
  }
  return parts.join(' · ')
}

/** Decode and validate a backup without writing anything. */
export function decodeBackup(bytes: Uint8Array): AppBackupPayload {
  if (bytes.length === 0) {
    throw new AppBackupException('That backup file is empty.')
  }

  let decoded: unknown
  try {
    decoded = JSON.parse(new TextDecoder().decode(bytes))
  } catch {
    throw new AppBackupException(
      'That file is not a valid Anima backup (bad JSON).',
    )
  }

  if (!decoded || typeof decoded !== 'object' || Array.isArray(decoded)) {
    throw new AppBackupException('That file is not a valid Anima backup.')
  }

  const map = decoded as Record<string, unknown>
  const format = map.format != null ? String(map.format) : null
  if (format !== FORMAT_ID) {
    throw new AppBackupException(
      format == null
        ? 'That file is not an Anima backup.'
        : `This backup format (“${format}”) is not supported.`,
    )
  }

  const filesRaw = map.files
  if (!filesRaw || typeof filesRaw !== 'object' || Array.isArray(filesRaw)) {
    throw new AppBackupException('Backup is missing its file list.')
  }

  const files: Record<string, string> = {}
  for (const [name, value] of Object.entries(filesRaw as Record<string, unknown>)) {
    if (!isAllowedDocumentName(name)) {
      throw new AppBackupException(`Backup has an unexpected file: ${name}`)
    }
    const text = value != null ? String(value) : ''
    if (utf8ByteLength(text) > MAX_JSON_FILE_BYTES) {
      throw new AppBackupException(`Backup file “${name}” is too large.`)
    }
    if (text.trim() && name.toLowerCase().endsWith('.json')) {
      try {
        JSON.parse(text)
      } catch {
        throw new AppBackupException(`Backup file “${name}” is not valid JSON.`)
      }
    }
    files[name] = text
  }

  const avatars = decodeImageMap(map.avatars, 'avatar')
  const chatBackgrounds = decodeImageMap(map.chatBackgrounds, 'chat background')
  const worlds = decodeWorlds(map.worlds)

  const settingsRaw = map.settings
  if (settingsRaw != null && (typeof settingsRaw !== 'object' || Array.isArray(settingsRaw))) {
    throw new AppBackupException('Backup settings list is invalid.')
  }
  const settings: Record<string, string> = {}
  if (settingsRaw && typeof settingsRaw === 'object') {
    for (const [key, value] of Object.entries(settingsRaw as Record<string, unknown>)) {
      if (key === API_KEY_STORAGE_KEY || key === 'nanogpt_api_key') {
        continue
      }
      if (!isAllowedPreferenceKey(key)) {
        throw new AppBackupException(`Backup has an unexpected setting: ${key}`)
      }
      settings[key] = value != null ? String(value) : ''
    }
  }

  let createdAt: string
  try {
    createdAt = new Date(String(map.createdAt ?? '')).toISOString()
    if (Number.isNaN(Date.parse(createdAt))) throw new Error('bad')
  } catch {
    createdAt = new Date().toISOString()
  }

  return {
    files,
    avatars,
    chatBackgrounds,
    worlds,
    settings,
    summary: {
      createdAt,
      fileCount: Object.keys(files).length,
      avatarCount: Object.keys(avatars).length,
      settingsCount: Object.keys(settings).length,
      worldFileCount: Object.keys(worlds).length,
    },
  }
}

function decodeImageMap(
  raw: unknown,
  label: string,
): Record<string, Uint8Array> {
  if (raw == null) return {}
  if (typeof raw !== 'object' || Array.isArray(raw)) {
    throw new AppBackupException(`Backup ${label} list is invalid.`)
  }
  const map = raw as Record<string, unknown>
  if (Object.keys(map).length > MAX_AVATAR_COUNT) {
    throw new AppBackupException(`Backup has too many ${label}s.`)
  }
  const out: Record<string, Uint8Array> = {}
  for (const [name, value] of Object.entries(map)) {
    if (!isSafeImageFileName(name)) {
      throw new AppBackupException(`Backup has an unsafe ${label} name: ${name}`)
    }
    try {
      const bytes = base64ToBytes(value != null ? String(value) : '')
      if (bytes.length > MAX_AVATAR_BYTES) {
        throw new AppBackupException(
          `${label[0]!.toUpperCase()}${label.slice(1)} “${name}” is too large.`,
        )
      }
      out[name] = bytes
    } catch (e) {
      if (e instanceof AppBackupException) throw e
      throw new AppBackupException(
        `${label[0]!.toUpperCase()}${label.slice(1)} “${name}” could not be decoded.`,
      )
    }
  }
  return out
}

function decodeWorlds(raw: unknown): Record<string, string> {
  if (raw == null) return {}
  if (typeof raw !== 'object' || Array.isArray(raw)) {
    throw new AppBackupException('Backup Living World list is invalid.')
  }
  const map = raw as Record<string, unknown>
  if (Object.keys(map).length > 200) {
    throw new AppBackupException('Backup has too many Living World files.')
  }
  const worlds: Record<string, string> = {}
  for (const [name, value] of Object.entries(map)) {
    if (!isSafeWorldFileName(name)) {
      throw new AppBackupException(
        `Backup has an unsafe Living World file name: ${name}`,
      )
    }
    const text = value != null ? String(value) : ''
    if (utf8ByteLength(text) > MAX_JSON_FILE_BYTES) {
      throw new AppBackupException(`Living World file “${name}” is too large.`)
    }
    if (text.trim()) {
      try {
        JSON.parse(text)
      } catch {
        throw new AppBackupException(
          `Living World file “${name}” is not valid JSON.`,
        )
      }
    }
    worlds[name] = text
  }
  return worlds
}

function asArray(value: unknown): unknown[] {
  if (Array.isArray(value)) return value
  if (value && typeof value === 'object') {
    const obj = value as Record<string, unknown>
    for (const key of [
      'characters',
      'personas',
      'chats',
      'sessions',
      'lorebooks',
      'workshops',
      'categories',
      'items',
      'data',
    ]) {
      if (Array.isArray(obj[key])) return obj[key] as unknown[]
    }
  }
  return []
}

function ensureId(raw: Record<string, unknown>, fallbackPrefix: string, index: number): string {
  const id = raw.id ?? raw.uuid ?? raw.key
  if (typeof id === 'string' && id.trim()) return id
  if (typeof id === 'number') return String(id)
  return `${fallbackPrefix}-${index}`
}

function parseCharacters(text: string): Character[] {
  if (!text.trim()) return []
  const data = JSON.parse(text) as unknown
  return asArray(data).map((item, i) => {
    const raw = (item && typeof item === 'object' ? item : {}) as Record<string, unknown>
    return {
      ...raw,
      id: ensureId(raw, 'char', i),
      name: String(raw.name ?? raw.char_name ?? 'Unnamed'),
    } as Character
  })
}

function parsePersonas(text: string): Persona[] {
  if (!text.trim()) return []
  const data = JSON.parse(text) as unknown
  return asArray(data).map((item, i) => {
    const raw = (item && typeof item === 'object' ? item : {}) as Record<string, unknown>
    return {
      ...raw,
      id: ensureId(raw, 'persona', i),
      name: String(raw.name ?? 'Unnamed'),
    } as Persona
  })
}

function parseCategories(text: string): CharacterCategory[] {
  if (!text.trim()) return []
  const data = JSON.parse(text) as unknown
  return asArray(data).map((item, i) => {
    const raw = (item && typeof item === 'object' ? item : {}) as Record<string, unknown>
    const ids = raw.characterIds ?? raw.character_ids ?? raw.members ?? []
    return {
      id: ensureId(raw, 'cat', i),
      name: String(raw.name ?? 'Category'),
      characterIds: Array.isArray(ids) ? ids.map(String) : [],
    }
  })
}

function normalizeMessage(raw: Record<string, unknown>, index: number) {
  const roleRaw = String(raw.role ?? 'user').toLowerCase()
  const role =
    roleRaw === 'assistant' ||
    roleRaw === 'narrator' ||
    roleRaw === 'director' ||
    roleRaw === 'user'
      ? roleRaw
      : 'user'
  return {
    id: String(raw.id ?? `msg-${index}`),
    role,
    text: String(raw.text ?? raw.content ?? ''),
    swipes: Array.isArray(raw.swipes) ? raw.swipes.map(String) : undefined,
    swipeIndex: typeof raw.swipeIndex === 'number' ? raw.swipeIndex : undefined,
    speakerId: raw.speakerId != null ? String(raw.speakerId) : undefined,
    speakerName: raw.speakerName != null ? String(raw.speakerName) : undefined,
    generationKind: raw.generationKind != null ? String(raw.generationKind) : undefined,
    generationGuide: raw.generationGuide != null ? String(raw.generationGuide) : undefined,
    createdAt: raw.createdAt != null ? String(raw.createdAt) : undefined,
  }
}

function parseChatSessions(text: string): ChatSession[] {
  if (!text.trim()) return []
  const data = JSON.parse(text) as unknown
  const sessions: ChatSession[] = []

  const pushList = (list: unknown[], isGroup: boolean) => {
    list.forEach((item, i) => {
      const raw = (item && typeof item === 'object' ? item : {}) as Record<string, unknown>
      const messagesRaw = Array.isArray(raw.messages) ? raw.messages : []
      sessions.push({
        ...raw,
        id: ensureId(raw, isGroup ? 'group' : 'chat', i),
        title: raw.title != null ? String(raw.title) : undefined,
        name: raw.name != null ? String(raw.name) : undefined,
        messages: messagesRaw.map((m, mi) =>
          normalizeMessage(
            (m && typeof m === 'object' ? m : {}) as Record<string, unknown>,
            mi,
          ),
        ),
        isGroup: isGroup || (Array.isArray(raw.participantIds) && raw.participantIds.length >= 2),
        updatedAt: raw.updatedAt != null ? String(raw.updatedAt) : undefined,
        createdAt: raw.createdAt != null ? String(raw.createdAt) : undefined,
      } as ChatSession)
    })
  }

  if (Array.isArray(data)) {
    pushList(data, false)
  } else if (data && typeof data === 'object') {
    const obj = data as Record<string, unknown>
    if (Array.isArray(obj.chats)) pushList(obj.chats, false)
    if (Array.isArray(obj.solo)) pushList(obj.solo, false)
    if (Array.isArray(obj.groups)) pushList(obj.groups, true)
    if (Array.isArray(obj.sessions)) pushList(obj.sessions, false)
    // Map-shaped store: id -> session
    const values = Object.values(obj)
    if (
      !obj.chats &&
      !obj.solo &&
      !obj.groups &&
      !obj.sessions &&
      values.every((v) => v && typeof v === 'object' && !Array.isArray(v))
    ) {
      pushList(values, false)
    }
  }
  return sessions
}

function parseLorebooks(text: string): GlobalLorebook[] {
  if (!text.trim()) return []
  const data = JSON.parse(text) as unknown
  return asArray(data).map((item, i) => {
    const raw = (item && typeof item === 'object' ? item : {}) as Record<string, unknown>
    const book =
      raw.book && typeof raw.book === 'object'
        ? (raw.book as GlobalLorebook['book'])
        : (raw as GlobalLorebook['book'])
    return {
      id: ensureId(raw, 'lore', i),
      name: String(raw.name ?? book.name ?? 'Lorebook'),
      enabled: raw.enabled !== false,
      book,
    }
  })
}

function parseWorkshops(text: string): WorldWorkshop[] {
  if (!text.trim()) return []
  const data = JSON.parse(text) as unknown
  return asArray(data).map((item, i) => {
    const raw = (item && typeof item === 'object' ? item : {}) as Record<string, unknown>
    return {
      ...raw,
      id: ensureId(raw, 'workshop', i),
      name: String(raw.name ?? 'Workshop'),
    } as WorldWorkshop
  })
}

function parseComposerDrafts(text: string): ComposerDraft[] {
  if (!text.trim()) return []
  const data = JSON.parse(text) as unknown
  if (Array.isArray(data)) {
    return data.map((item, i) => {
      const raw = (item && typeof item === 'object' ? item : {}) as Record<string, unknown>
      return {
        chatId: String(raw.chatId ?? raw.id ?? `draft-${i}`),
        text: String(raw.text ?? ''),
        updatedAt: String(raw.updatedAt ?? new Date().toISOString()),
      }
    })
  }
  if (data && typeof data === 'object') {
    return Object.entries(data as Record<string, unknown>).map(([chatId, value]) => {
      if (typeof value === 'string') {
        return { chatId, text: value, updatedAt: new Date().toISOString() }
      }
      const raw = (value && typeof value === 'object' ? value : {}) as Record<string, unknown>
      return {
        chatId: String(raw.chatId ?? chatId),
        text: String(raw.text ?? ''),
        updatedAt: String(raw.updatedAt ?? new Date().toISOString()),
      }
    })
  }
  return []
}

function parseRoadwayCache(text: string): RoadwayCacheEntry[] {
  if (!text.trim()) return []
  const data = JSON.parse(text) as unknown
  if (Array.isArray(data)) {
    return data.map((item, i) => {
      const raw = (item && typeof item === 'object' ? item : {}) as Record<string, unknown>
      return {
        chatId: String(raw.chatId ?? raw.id ?? `road-${i}`),
        anchorMessageId: raw.anchorMessageId != null ? String(raw.anchorMessageId) : undefined,
        options: Array.isArray(raw.options) ? raw.options.map(String) : [],
        direction: raw.direction != null ? String(raw.direction) : undefined,
        updatedAt: String(raw.updatedAt ?? new Date().toISOString()),
      }
    })
  }
  if (data && typeof data === 'object') {
    return Object.entries(data as Record<string, unknown>).map(([chatId, value]) => {
      const raw = (value && typeof value === 'object' ? value : {}) as Record<string, unknown>
      return {
        chatId: String(raw.chatId ?? chatId),
        anchorMessageId: raw.anchorMessageId != null ? String(raw.anchorMessageId) : undefined,
        options: Array.isArray(raw.options) ? raw.options.map(String) : [],
        direction: raw.direction != null ? String(raw.direction) : undefined,
        updatedAt: String(raw.updatedAt ?? new Date().toISOString()),
      }
    })
  }
  return []
}

function parseFavoriteModelsFromSettingsJson(text: string): FavoriteModel[] {
  if (!text.trim()) return []
  try {
    const data = JSON.parse(text) as Record<string, unknown>
    const favs = data.favoriteModels ?? data.favorite_models
    if (!Array.isArray(favs)) return []
    return favs
      .map((item, i) => {
        const raw = (item && typeof item === 'object' ? item : {}) as Record<string, unknown>
        const id = String(raw.id ?? '')
        if (!id) return null
        return {
          id,
          name: String(raw.name ?? id),
          starredAt: String(raw.starredAt ?? raw.starred_at ?? new Date(Date.now() - i).toISOString()),
        } satisfies FavoriteModel
      })
      .filter((x): x is FavoriteModel => x != null)
  } catch {
    return []
  }
}

function mediaFromBytes(
  fileName: string,
  bytes: Uint8Array,
  kind: MediaBlob['kind'],
): MediaBlob {
  const copy = new Uint8Array(bytes.byteLength)
  copy.set(bytes)
  return {
    id: `${kind}:${fileName}`,
    fileName,
    kind,
    mimeType: mimeFromFileName(fileName),
    data: copy.buffer,
    byteLength: bytes.length,
    updatedAt: new Date().toISOString(),
  }
}

/**
 * Restore a decoded backup into IndexedDB.
 * Clears library tables first, but preserves the device-local API key.
 */
export async function restoreBackupToDb(
  bytes: Uint8Array,
  db: AnimaDatabase = getDb(),
): Promise<AppBackupSummary> {
  const payload = decodeBackup(bytes)

  const existingKey = await db.settings.get(API_KEY_STORAGE_KEY)

  await db.transaction(
    'rw',
    [
      db.characters,
      db.categories,
      db.personas,
      db.chatSessions,
      db.lorebooks,
      db.workshops,
      db.settings,
      db.favoriteModels,
      db.composerDrafts,
      db.roadwayCache,
      db.media,
      db.worldFiles,
    ],
    async () => {
      await Promise.all([
        db.characters.clear(),
        db.categories.clear(),
        db.personas.clear(),
        db.chatSessions.clear(),
        db.lorebooks.clear(),
        db.workshops.clear(),
        db.settings.clear(),
        db.favoriteModels.clear(),
        db.composerDrafts.clear(),
        db.roadwayCache.clear(),
        db.media.clear(),
        db.worldFiles.clear(),
      ])

      const characters = parseCharacters(payload.files['anima_characters.json'] ?? '')
      const personas = parsePersonas(payload.files['anima_personas.json'] ?? '')
      const categories = parseCategories(
        payload.files['anima_character_categories.json'] ?? '',
      )
      const chats = parseChatSessions(payload.files['anima_chats.json'] ?? '')
      const lorebooks = parseLorebooks(payload.files['anima_lorebooks.json'] ?? '')
      const workshops = parseWorkshops(
        payload.files['anima_world_workshops.json'] ?? '',
      )
      const drafts = parseComposerDrafts(
        payload.files['anima_composer_drafts.json'] ?? '',
      )
      const roadway = parseRoadwayCache(
        payload.files['anima_roadway_cache.json'] ?? '',
      )

      if (characters.length) await db.characters.bulkPut(characters)
      if (personas.length) await db.personas.bulkPut(personas)
      if (categories.length) await db.categories.bulkPut(categories)
      if (chats.length) await db.chatSessions.bulkPut(chats)
      if (lorebooks.length) await db.lorebooks.bulkPut(lorebooks)
      if (workshops.length) await db.workshops.bulkPut(workshops)
      if (drafts.length) await db.composerDrafts.bulkPut(drafts)
      if (roadway.length) await db.roadwayCache.bulkPut(roadway)

      const settingsRows = Object.entries(payload.settings).map(([key, value]) => ({
        key,
        value,
      }))

      // Also fold anima_settings.json into settings key store (non-secret).
      const settingsFile = payload.files['anima_settings.json']
      if (settingsFile?.trim()) {
        settingsRows.push({ key: 'anima_settings.json', value: settingsFile })
        const favs = parseFavoriteModelsFromSettingsJson(settingsFile)
        if (favs.length) await db.favoriteModels.bulkPut(favs)
      }

      const activeTxt = payload.files['anima_active_persona_id.txt']
      if (activeTxt != null && activeTxt.trim()) {
        settingsRows.push({ key: ACTIVE_PERSONA_ID_KEY, value: activeTxt.trim() })
      }

      if (settingsRows.length) await db.settings.bulkPut(settingsRows)

      // Restore device API key if it existed before restore.
      if (existingKey?.value) {
        await db.settings.put(existingKey)
      }

      const mediaRows: MediaBlob[] = []
      for (const [name, bytes] of Object.entries(payload.avatars)) {
        mediaRows.push(mediaFromBytes(name, bytes, 'avatar'))
      }
      for (const [name, bytes] of Object.entries(payload.chatBackgrounds)) {
        mediaRows.push(mediaFromBytes(name, bytes, 'chatBackground'))
      }
      if (mediaRows.length) await db.media.bulkPut(mediaRows)

      const worldRows = Object.entries(payload.worlds).map(([fileName, content]) => ({
        fileName,
        content,
        updatedAt: new Date().toISOString(),
      }))
      if (worldRows.length) await db.worldFiles.bulkPut(worldRows)
    },
  )

  return {
    ...payload.summary,
    characters: await db.characters.count(),
    personas: await db.personas.count(),
    chats: await db.chatSessions.count(),
    lorebooks: await db.lorebooks.count(),
    workshops: await db.workshops.count(),
  }
}

/** Export current IndexedDB library to `.anima-backup` JSON (no API key). */
export async function exportBackupFromDb(
  db: AnimaDatabase = getDb(),
): Promise<AppBackupBundle> {
  const files: Record<string, string> = {}

  const characters = await db.characters.toArray()
  files['anima_characters.json'] = JSON.stringify(characters, null, 2)

  const chats = await db.chatSessions.toArray()
  const solo = chats.filter((c) => !c.isGroup)
  const groups = chats.filter((c) => c.isGroup)
  files['anima_chats.json'] = JSON.stringify({ chats: solo, groups }, null, 2)

  files['anima_personas.json'] = JSON.stringify(await db.personas.toArray(), null, 2)
  files['anima_character_categories.json'] = JSON.stringify(
    await db.categories.toArray(),
    null,
    2,
  )
  files['anima_lorebooks.json'] = JSON.stringify(await db.lorebooks.toArray(), null, 2)
  files['anima_world_workshops.json'] = JSON.stringify(
    await db.workshops.toArray(),
    null,
    2,
  )
  files['anima_composer_drafts.json'] = JSON.stringify(
    await db.composerDrafts.toArray(),
    null,
    2,
  )
  files['anima_roadway_cache.json'] = JSON.stringify(
    await db.roadwayCache.toArray(),
    null,
    2,
  )

  const settingsFile = await db.settings.get('anima_settings.json')
  const favoriteModels = await db.favoriteModels.toArray()
  if (settingsFile?.value) {
    try {
      const parsed = JSON.parse(settingsFile.value) as Record<string, unknown>
      parsed.favoriteModels = favoriteModels
      files['anima_settings.json'] = JSON.stringify(parsed, null, 2)
    } catch {
      files['anima_settings.json'] = settingsFile.value
    }
  } else {
    files['anima_settings.json'] = JSON.stringify({ favoriteModels }, null, 2)
  }

  const active = await db.settings.get(ACTIVE_PERSONA_ID_KEY)
  if (active?.value) {
    files['anima_active_persona_id.txt'] = active.value
  }

  const avatars: Record<string, string> = {}
  const chatBackgrounds: Record<string, string> = {}
  const media = await db.media.toArray()
  for (const item of media) {
    const bytes = new Uint8Array(item.data)
    if (bytes.length > MAX_AVATAR_BYTES) {
      throw new AppBackupException(
        `${item.kind === 'avatar' ? 'Avatar' : 'Chat background'} “${item.fileName}” is too large to include in a backup.`,
      )
    }
    const b64 = bytesToBase64(bytes)
    if (item.kind === 'chatBackground') {
      chatBackgrounds[item.fileName] = b64
    } else {
      avatars[item.fileName] = b64
    }
  }

  const worlds: Record<string, string> = {}
  for (const w of await db.worldFiles.toArray()) {
    worlds[w.fileName] = w.content
  }

  const preferences: Record<string, string> = {}
  for (const row of await db.settings.toArray()) {
    if (row.key === API_KEY_STORAGE_KEY || row.key === 'nanogpt_api_key') continue
    if (row.key === 'anima_settings.json') continue
    if (!isAllowedPreferenceKey(row.key) && row.key !== FAVORITE_MODELS_KEY) continue
    preferences[row.key] = row.value
  }

  const createdAt = new Date().toISOString()
  const payload: Record<string, unknown> = {
    format: FORMAT_ID,
    createdAt,
    files,
    avatars,
    settings: preferences,
  }
  if (Object.keys(chatBackgrounds).length) {
    payload.chatBackgrounds = chatBackgrounds
  }
  if (Object.keys(worlds).length) {
    payload.worlds = worlds
  }

  const json = JSON.stringify(payload, null, 2)
  const bytes = new TextEncoder().encode(json)
  const summary: AppBackupSummary = {
    createdAt,
    fileCount: Object.keys(files).length,
    avatarCount: Object.keys(avatars).length,
    settingsCount: Object.keys(preferences).length,
    worldFileCount: Object.keys(worlds).length,
  }

  return { json, bytes, summary }
}

export function downloadBackupFile(bundle: AppBackupBundle, fileName?: string): void {
  const name =
    fileName ??
    `anima-backup-${bundle.summary.createdAt.slice(0, 10)}.${FILE_EXTENSION}`
  const blob = new Blob([bundle.json], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = name
  a.click()
  URL.revokeObjectURL(url)
}
