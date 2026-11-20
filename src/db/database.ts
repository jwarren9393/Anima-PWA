import Dexie, { type EntityTable } from 'dexie'
import type {
  Character,
  CharacterCategory,
  ChatSession,
  ComposerDraft,
  FavoriteModel,
  GlobalLorebook,
  MediaBlob,
  Persona,
  RoadwayCacheEntry,
  AppSettingsRecord,
  WorldFileRecord,
  WorldWorkshop,
} from '../models/types'

export class AnimaDatabase extends Dexie {
  characters!: EntityTable<Character, 'id'>
  categories!: EntityTable<CharacterCategory, 'id'>
  personas!: EntityTable<Persona, 'id'>
  chatSessions!: EntityTable<ChatSession, 'id'>
  lorebooks!: EntityTable<GlobalLorebook, 'id'>
  workshops!: EntityTable<WorldWorkshop, 'id'>
  settings!: EntityTable<AppSettingsRecord, 'key'>
  favoriteModels!: EntityTable<FavoriteModel, 'id'>
  composerDrafts!: EntityTable<ComposerDraft, 'chatId'>
  roadwayCache!: EntityTable<RoadwayCacheEntry, 'chatId'>
  media!: EntityTable<MediaBlob, 'id'>
  worldFiles!: EntityTable<WorldFileRecord, 'fileName'>

  constructor(name = 'anima-pwa') {
    super(name)
    this.version(1).stores({
      characters: 'id, name',
      categories: 'id, name',
      personas: 'id, name',
      chatSessions: 'id, updatedAt, isGroup, characterId',
      lorebooks: 'id, name, enabled',
      workshops: 'id, name, updatedAt',
      settings: 'key',
      favoriteModels: 'id, starredAt',
      composerDrafts: 'chatId, updatedAt',
      roadwayCache: 'chatId, updatedAt',
      media: 'id, fileName, kind',
      worldFiles: 'fileName',
    })
  }
}

let dbInstance: AnimaDatabase | null = null

export function getDb(): AnimaDatabase {
  if (!dbInstance) {
    dbInstance = new AnimaDatabase()
  }
  return dbInstance
}

/** Test helper — wipe and replace the singleton. */
export async function resetDbForTests(name = `anima-test-${Date.now()}`): Promise<AnimaDatabase> {
  if (dbInstance) {
    dbInstance.close()
    await Dexie.delete(dbInstance.name)
  }
  dbInstance = new AnimaDatabase(name)
  return dbInstance
}

export async function clearAllTables(db: AnimaDatabase = getDb()): Promise<void> {
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
}

export async function getLibraryStats(db: AnimaDatabase = getDb()) {
  const [characters, personas, lorebooks, chats, workshops, media] =
    await Promise.all([
      db.characters.count(),
      db.personas.count(),
      db.lorebooks.count(),
      db.chatSessions.count(),
      db.workshops.count(),
      db.media.count(),
    ])
  return { characters, personas, lorebooks, chats, workshops, media }
}
