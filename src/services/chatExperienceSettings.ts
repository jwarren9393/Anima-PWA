import type { ChatExperienceSettings, ChatLayoutMode } from '../models/types'
import { getSetting, setSetting } from './settingsStore'

const KEY = 'chat_experience_settings'

export const DEFAULT_CHAT_EXPERIENCE: ChatExperienceSettings = {
  layoutMode: 'classic',
  bubbleOpacity: 1,
  speakerHeader: false,
  sideHero: false,
  cornerRadius: 16,
}

export const STORYBOOK_DEFAULTS: ChatExperienceSettings = {
  layoutMode: 'storybook',
  bubbleOpacity: 0.48,
  speakerHeader: true,
  sideHero: true,
  cornerRadius: 16,
}

export async function getChatExperience(): Promise<ChatExperienceSettings> {
  const raw = await getSetting(KEY)
  if (!raw) return { ...DEFAULT_CHAT_EXPERIENCE }
  try {
    const parsed = JSON.parse(raw) as Partial<ChatExperienceSettings>
    return {
      ...DEFAULT_CHAT_EXPERIENCE,
      ...parsed,
      layoutMode: parsed.layoutMode === 'storybook' ? 'storybook' : 'classic',
      bubbleOpacity: clamp(parsed.bubbleOpacity ?? 1, 0.2, 1),
      cornerRadius: clamp(parsed.cornerRadius ?? 16, 12, 24),
    }
  } catch {
    return { ...DEFAULT_CHAT_EXPERIENCE }
  }
}

export async function setChatExperience(next: ChatExperienceSettings): Promise<void> {
  await setSetting(KEY, JSON.stringify(next))
}

export async function setLayoutMode(mode: ChatLayoutMode): Promise<ChatExperienceSettings> {
  const base = mode === 'storybook' ? STORYBOOK_DEFAULTS : DEFAULT_CHAT_EXPERIENCE
  const current = await getChatExperience()
  const next = { ...current, ...base, layoutMode: mode }
  await setChatExperience(next)
  return next
}

export function applyChatExperienceToDom(settings: ChatExperienceSettings): void {
  const root = document.documentElement
  root.dataset.chatLayout = settings.layoutMode
  root.style.setProperty('--chat-bubble-opacity', String(settings.bubbleOpacity))
  root.style.setProperty('--radius-card', `${settings.cornerRadius}px`)
  root.style.setProperty('--chat-bubble-max', settings.layoutMode === 'storybook' ? '88%' : '68%')
}

function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n))
}
