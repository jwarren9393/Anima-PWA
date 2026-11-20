import { getDb } from '../db/database'
import {
  API_KEY_STORAGE_KEY,
  CHAT_MODEL_ID_KEY,
  FAVORITE_MODELS_KEY,
  USE_SUBSCRIPTION_KEY,
  type FavoriteModel,
} from '../models/types'

export async function getSetting(key: string): Promise<string | null> {
  const row = await getDb().settings.get(key)
  return row?.value ?? null
}

export async function setSetting(key: string, value: string): Promise<void> {
  await getDb().settings.put({ key, value })
}

export async function deleteSetting(key: string): Promise<void> {
  await getDb().settings.delete(key)
}

export async function getApiKey(): Promise<string> {
  return (await getSetting(API_KEY_STORAGE_KEY)) ?? ''
}

export async function setApiKey(key: string): Promise<void> {
  const trimmed = key.trim()
  if (!trimmed) {
    await deleteSetting(API_KEY_STORAGE_KEY)
    return
  }
  await setSetting(API_KEY_STORAGE_KEY, trimmed)
}

export async function clearApiKey(): Promise<void> {
  await deleteSetting(API_KEY_STORAGE_KEY)
}

export async function getUseSubscription(): Promise<boolean> {
  return (await getSetting(USE_SUBSCRIPTION_KEY)) === 'true'
}

export async function setUseSubscription(value: boolean): Promise<void> {
  await setSetting(USE_SUBSCRIPTION_KEY, value ? 'true' : 'false')
}

export async function getChatModelId(): Promise<string> {
  return (await getSetting(CHAT_MODEL_ID_KEY)) ?? ''
}

export async function setChatModelId(id: string): Promise<void> {
  await setSetting(CHAT_MODEL_ID_KEY, id)
}

export async function listFavoriteModels(): Promise<FavoriteModel[]> {
  const fromTable = await getDb().favoriteModels.orderBy('starredAt').reverse().toArray()
  if (fromTable.length) return fromTable

  const raw = await getSetting(FAVORITE_MODELS_KEY)
  if (!raw) return []
  try {
    const parsed = JSON.parse(raw) as FavoriteModel[]
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

export async function toggleFavoriteModel(model: {
  id: string
  name: string
}): Promise<FavoriteModel[]> {
  const db = getDb()
  const existing = await db.favoriteModels.get(model.id)
  if (existing) {
    await db.favoriteModels.delete(model.id)
  } else {
    await db.favoriteModels.put({
      id: model.id,
      name: model.name,
      starredAt: new Date().toISOString(),
    })
  }
  const list = await listFavoriteModels()
  await setSetting(FAVORITE_MODELS_KEY, JSON.stringify(list))
  return list
}
