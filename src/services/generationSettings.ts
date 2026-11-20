import { getSetting, setSetting } from './settingsStore'

export type SamplingSettings = {
  temperature: number
  topP: number
  maxTokens: number
  frequencyPenalty: number
  presencePenalty: number
}

export type LoreScanSettings = {
  scanDepth: number
  tokenBudget: number
  recursive: boolean
}

const DEFAULT_SAMPLING: SamplingSettings = {
  temperature: 0.9,
  topP: 0.95,
  maxTokens: 1024,
  frequencyPenalty: 0,
  presencePenalty: 0,
}

const DEFAULT_LORE: LoreScanSettings = {
  scanDepth: 4,
  tokenBudget: 512,
  recursive: false,
}

async function readNumber(key: string, fallback: number): Promise<number> {
  const raw = await getSetting(key)
  if (raw == null || raw === '') return fallback
  const n = Number(raw)
  return Number.isFinite(n) ? n : fallback
}

export async function getSamplingSettings(): Promise<SamplingSettings> {
  return {
    temperature: await readNumber('temperature', DEFAULT_SAMPLING.temperature),
    topP: await readNumber('top_p', DEFAULT_SAMPLING.topP),
    maxTokens: await readNumber('max_tokens', DEFAULT_SAMPLING.maxTokens),
    frequencyPenalty: await readNumber(
      'frequency_penalty',
      DEFAULT_SAMPLING.frequencyPenalty,
    ),
    presencePenalty: await readNumber(
      'presence_penalty',
      DEFAULT_SAMPLING.presencePenalty,
    ),
  }
}

export async function getLoreScanSettings(): Promise<LoreScanSettings> {
  return {
    scanDepth: await readNumber('lore_scan_depth', DEFAULT_LORE.scanDepth),
    tokenBudget: await readNumber('lore_token_budget', DEFAULT_LORE.tokenBudget),
    recursive: (await getSetting('lore_recursive_scan')) === 'true',
  }
}

export async function getGlobalPrompts(): Promise<{
  system: string
  postHistory: string
}> {
  return {
    system: (await getSetting('global_system_prompt')) ?? '',
    postHistory: (await getSetting('global_post_history')) ?? '',
  }
}

export async function setLoreScanSettings(s: LoreScanSettings): Promise<void> {
  await setSetting('lore_scan_depth', String(s.scanDepth))
  await setSetting('lore_token_budget', String(s.tokenBudget))
  await setSetting('lore_recursive_scan', s.recursive ? 'true' : 'false')
}

/** 0 = auto-summarize off */
export async function getAutoSummarizeEvery(): Promise<number> {
  return readNumber('auto_summarize_every', 0)
}

export async function setAutoSummarizeEvery(n: number): Promise<void> {
  await setSetting('auto_summarize_every', String(Math.max(0, Math.floor(n))))
}
