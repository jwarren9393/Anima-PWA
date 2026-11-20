/** Core Anima entity types — mirrored from LEGACY_FLUTTER_REFERENCE.md for Phase 1+. */

export type ChatRole = 'user' | 'assistant' | 'narrator' | 'director' | 'groupBeat'

/** One character line inside a groupBeat message. */
export interface GroupBeatPart {
  speakerId: string
  speakerName: string
  text: string
}

export interface ChatMessage {
  id: string
  role: ChatRole
  text: string
  swipes?: string[]
  swipeIndex?: number
  speakerId?: string
  speakerName?: string
  generationKind?: string
  generationGuide?: string
  /** Active beat lines when role === 'groupBeat' */
  beatLines?: GroupBeatPart[]
  /** Alternate beat variants (JSON-encoded in swipes for backup compat) */
  beatSwipes?: GroupBeatPart[][]
  createdAt?: string
}

/** Chat layout / bubble experience (Theme Studio). */
export type ChatLayoutMode = 'classic' | 'storybook'

export interface ChatExperienceSettings {
  layoutMode: ChatLayoutMode
  bubbleOpacity: number
  speakerHeader: boolean
  sideHero: boolean
  cornerRadius: number
}

export interface ChatSession {
  id: string
  title?: string
  name?: string
  messages: ChatMessage[]
  authorsNote?: string
  personaId?: string | null
  autoReply?: boolean
  lorebookIds?: string[] | null
  memorySummary?: string
  memoryCoveredCount?: number
  participantIds?: string[]
  nextSpeakerIndex?: number
  sourceWorkshopId?: string | null
  castJoinedAt?: Record<string, number>
  characterId?: string | null
  updatedAt?: string
  createdAt?: string
  isGroup?: boolean
}

export interface LorebookEntry {
  id?: string
  keys?: string[]
  secondary_keys?: string[]
  content?: string
  comment?: string
  enabled?: boolean
  constant?: boolean
  position?: string | number
  insertion_order?: number
  priority?: number
  selective?: boolean
  [key: string]: unknown
}

export interface LorebookBook {
  name?: string
  description?: string
  scan_depth?: number
  token_budget?: number
  recursive_scanning?: boolean
  entries?: LorebookEntry[] | Record<string, LorebookEntry>
  [key: string]: unknown
}

export interface Character {
  id: string
  name: string
  description?: string
  personality?: string
  scenario?: string
  first_mes?: string
  alternate_greetings?: string[]
  mes_example?: string
  system_prompt?: string
  post_history_instructions?: string
  character_book?: LorebookBook | null
  avatarFileName?: string | null
  tags?: string[]
  creator_notes?: string
  /** Preserve unknown ST / Anima fields */
  [key: string]: unknown
}

export interface CharacterCategory {
  id: string
  name: string
  characterIds: string[]
}

export interface Persona {
  id: string
  name: string
  identity?: string
  role?: string
  appearance?: string
  personality?: string
  background?: string
  goals?: string
  avatarFileName?: string | null
  promptText?: string
  [key: string]: unknown
}

export interface GlobalLorebook {
  id: string
  name: string
  enabled: boolean
  book: LorebookBook
}

export interface WorkshopMessage {
  id?: string
  role?: string
  text?: string
  [key: string]: unknown
}

export interface WorldWorkshop {
  id: string
  name: string
  messages?: WorkshopMessage[]
  worldSummary?: string
  linkedLorebookId?: string | null
  hub?: Record<string, unknown>
  updatedAt?: string
  createdAt?: string
  [key: string]: unknown
}

export interface FavoriteModel {
  id: string
  name: string
  starredAt: string
}

export interface ComposerDraft {
  chatId: string
  text: string
  updatedAt: string
}

export interface RoadwayCacheEntry {
  chatId: string
  anchorMessageId?: string
  options: string[]
  direction?: string
  updatedAt: string
}

export type MediaKind = 'avatar' | 'chatBackground' | 'other'

export interface MediaBlob {
  id: string
  fileName: string
  kind: MediaKind
  mimeType: string
  /** Raw image bytes (ArrayBuffer survives IndexedDB round-trips reliably). */
  data: ArrayBuffer
  byteLength: number
  updatedAt: string
}

export interface WorldFileRecord {
  fileName: string
  content: string
  updatedAt: string
}

export interface AppSettingsRecord {
  key: string
  value: string
}

/** Typed view of common settings (stored as string key/values in Dexie). */
export interface AnimaSettings {
  chatModelId?: string
  imageModelId?: string
  useSubscriptionEndpoint?: boolean
  temperature?: number
  topP?: number
  maxTokens?: number
  frequencyPenalty?: number
  presencePenalty?: number
  repetitionPenalty?: number
  favoriteModels?: FavoriteModel[]
  globalSystemPrompt?: string
  globalPostHistory?: string
  autoSummarizeEvery?: number
  [key: string]: unknown
}

export interface LibraryStats {
  characters: number
  personas: number
  lorebooks: number
  chats: number
  workshops: number
  media: number
}

export const API_KEY_STORAGE_KEY = 'nanogpt_api_key'
export const ACTIVE_PERSONA_ID_KEY = 'active_persona_id'
export const USE_SUBSCRIPTION_KEY = 'use_subscription_endpoint'
export const CHAT_MODEL_ID_KEY = 'chat_model_id'
export const FAVORITE_MODELS_KEY = 'favorite_models'
