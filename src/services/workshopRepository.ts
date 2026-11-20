import { getDb } from '../db/database'
import { newId } from '../lib/ids'
import type { WorkshopMessage, WorldWorkshop } from '../models/types'

export async function listWorkshops(): Promise<WorldWorkshop[]> {
  const rows = await getDb().workshops.toArray()
  return rows.sort((a, b) => String(b.updatedAt ?? '').localeCompare(String(a.updatedAt ?? '')))
}

export async function getWorkshop(id: string): Promise<WorldWorkshop | undefined> {
  return getDb().workshops.get(id)
}

export async function saveWorkshop(workshop: WorldWorkshop): Promise<void> {
  await getDb().workshops.put({
    ...workshop,
    updatedAt: new Date().toISOString(),
  })
}

export async function deleteWorkshop(id: string): Promise<void> {
  await getDb().workshops.delete(id)
}

export async function createWorkshop(name?: string): Promise<WorldWorkshop> {
  const now = new Date().toISOString()
  const workshop: WorldWorkshop = {
    id: newId('ws'),
    name: name?.trim() || 'New workshop',
    messages: [],
    worldSummary: '',
    linkedLorebookId: null,
    hub: {},
    createdAt: now,
    updatedAt: now,
  }
  await saveWorkshop(workshop)
  return workshop
}

export async function appendWorkshopMessage(
  workshop: WorldWorkshop,
  message: WorkshopMessage,
): Promise<WorldWorkshop> {
  const next: WorldWorkshop = {
    ...workshop,
    messages: [...(workshop.messages ?? []), message],
  }
  await saveWorkshop(next)
  return next
}
