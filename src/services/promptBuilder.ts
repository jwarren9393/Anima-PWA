/**
 * Prompt assembly order — mirrors LEGACY_FLUTTER_REFERENCE.md §10.
 */

import { applyMacros } from '../lib/macros'
import { estimateTokens } from '../lib/tokens'
import type { Character, ChatMessage, ChatSession, Persona } from '../models/types'
import type { ChatApiMessage } from './nanogpt'
import { activeBeatLines, formatBeatForPrompt } from './groupBeatCodec'
import {
  formatLoreSection,
  scanLorebooks,
  type LoreScanOptions,
  type LoreScanResult,
} from './lorebookService'
import { formatPersonaPromptBlock } from './personaCardCodec'
import { formatKnowledgeBoundary } from './presenceService'
import {
  buildRewriteMessages,
  type RewriteMode,
} from './replyRewriteService'

export const ANIMA_DEFAULT_SEED =
  'Write an engaging roleplay reply as {{char}}. Stay in character. Use *asterisks* for actions and "quotes" for dialogue. Reply in first person as {{char}}.'

export type PromptMode = 'normal' | 'continueScene' | 'impersonate'

export type BuildPromptInput = {
  character: Character
  persona?: Persona | null
  session: ChatSession
  mode?: PromptMode
  globalSystemPrompt?: string
  globalPostHistory?: string
  loreBooks?: Parameters<typeof scanLorebooks>[1]
  loreOptions?: LoreScanOptions
  historyTokenBudget?: number
  /** Alternate greeting index when starting / regenerating opening */
  greetingIndex?: number
  /** My line… steer for Impersonate */
  playerGuideNote?: string
  /** Extra group members — short card summaries only */
  others?: Character[]
  /** Optional handoff nudge (group chats) */
  handoffNudge?: { role: 'user'; content: string } | null
  /** Mid-chat join catch-up system block */
  catchUpBlock?: string | null
  /** Apply presence knowledge boundary (groups) */
  presenceBoundary?: boolean
  /** Rewrite the given assistant reply instead of a normal turn */
  rewrite?: {
    mode: RewriteMode
    currentReply: string
    customInstruction?: string
  }
}

export function formatPlayerDirection(note: string | undefined, userName: string): string {
  const guide =
    note?.trim() ||
    `Write {{user}}'s next line naturally in first person as ${userName}.`
  return [
    '[PLAYER GUIDE — mandatory]',
    applyMacros(guide, { userName, charName: 'Character' }),
    `Write ONLY as ${userName} ({{user}}). Do not write {{char}}'s lines.`,
  ].join('\n')
}

export type BuiltPrompt = {
  messages: ChatApiMessage[]
  lore: LoreScanResult
  systemPrompt: string
  postHistory: string
}

function formatMemoryForPrompt(summary: string): string {
  return [
    '[Memory summary — reference facts only. Do not mimic this tone or style in your reply.]',
    summary.trim(),
  ].join('\n')
}

function formatNarratorBlock(text: string, isLatest: boolean): string {
  const tag = isLatest ? 'Narrator (current scene law)' : 'Narrator (background)'
  return `[${tag}]\n${text.trim()}`
}

function formatDirectorBlock(text: string): string {
  return [
    '[Director — mandatory for your next reply]',
    text.trim(),
    'Follow this instruction exactly in the upcoming reply.',
  ].join('\n')
}

function firstPersonRule(speakerName: string): string {
  return `Write only the next reply as ${speakerName}, in first person (*I …* for actions, "…" for dialogue). Do not write {{user}}'s lines.`
}

/** Short description + personality snippet for group prompts. */
export function characterSummary(character: Character): string {
  const bits = [
    character.description?.trim(),
    character.personality?.trim(),
  ].filter(Boolean) as string[]
  if (!bits.length) return ''
  const joined = bits.join(' ')
  return joined.length <= 280 ? joined : `${joined.slice(0, 280)}…`
}

export function buildSystemPrompt(input: BuildPromptInput, lore: LoreScanResult): string {
  const mode = input.mode ?? 'normal'
  const charName = input.character.name
  const userName = input.persona?.name ?? 'User'
  const macros = {
    userName,
    charName,
    defaultSeed: ANIMA_DEFAULT_SEED,
  }

  const parts: string[] = []

  const cardSystem = input.character.system_prompt?.trim()
  if (cardSystem) {
    parts.push(applyMacros(cardSystem, macros))
  } else {
    parts.push(applyMacros(ANIMA_DEFAULT_SEED, macros))
  }

  if (mode === 'impersonate') {
    parts.push(
      applyMacros(
        'You are writing as {{user}} (the player). Character card fields below are the other person — reference only. Do not speak as {{char}}.',
        macros,
      ),
    )
  } else {
    parts.push(applyMacros('You are {{char}}. Stay in character.', macros))
  }

  const others = input.others ?? []
  if (others.length) {
    const names = others
      .map((c) => c.name.trim())
      .filter(Boolean)
      .join(', ')
    if (mode === 'impersonate') {
      parts.push(
        `This is a group chat. Other people present: ${names}. ` +
          `Right now you are only writing as ${userName} (the player). ` +
          `Card summaries below are identity reference for people in the scene — ` +
          `not your voice. ` +
          `Do not start your reply with "${userName}:" or your name — ` +
          `the app already labels who is speaking.`,
      )
    } else {
      parts.push(
        `This is a group chat. Other people present: ${names}. ` +
          `Right now you are only writing as ${charName}. ` +
          `Card summaries below are identity reference only — not what you know ` +
          `they did in scenes you missed. ` +
          `Do not start your reply with "${charName}:" or your name — ` +
          `the app already labels who is speaking.`,
      )
    }
    for (const other of others) {
      const summary = characterSummary(other)
      if (summary) parts.push(`About ${other.name.trim()}:\n${summary}`)
    }
  }

  if (input.presenceBoundary && mode !== 'impersonate') {
    parts.push(formatKnowledgeBoundary(charName, userName))
  }

  const before = formatLoreSection('World info (before character)', lore.beforeChar)
  if (before) parts.push(applyMacros(before, macros))

  const cardBits: string[] = []
  if (input.character.description?.trim()) {
    cardBits.push(`Description:\n${input.character.description.trim()}`)
  }
  if (input.character.personality?.trim()) {
    cardBits.push(`Personality:\n${input.character.personality.trim()}`)
  }
  if (input.character.scenario?.trim()) {
    cardBits.push(`Scenario:\n${input.character.scenario.trim()}`)
  }
  if (input.character.mes_example?.trim()) {
    cardBits.push(`Example dialogue:\n${input.character.mes_example.trim()}`)
  }
  if (cardBits.length) {
    parts.push(applyMacros(cardBits.join('\n\n'), macros))
  }

  const after = formatLoreSection('World info (after character)', lore.afterChar)
  if (after) parts.push(applyMacros(after, macros))

  if (input.persona) {
    parts.push(applyMacros(formatPersonaPromptBlock(input.persona), macros))
  }

  if (input.globalSystemPrompt?.trim()) {
    parts.push(applyMacros(input.globalSystemPrompt.trim(), macros))
  }

  return parts.filter(Boolean).join('\n\n')
}

export function buildPostHistory(input: BuildPromptInput): string {
  const mode = input.mode ?? 'normal'
  const charName = input.character.name
  const userName = input.persona?.name ?? 'User'
  const macros = { userName, charName, defaultSeed: ANIMA_DEFAULT_SEED }
  const parts: string[] = []

  if (input.globalPostHistory?.trim()) {
    parts.push(applyMacros(input.globalPostHistory.trim(), macros))
  }

  if (mode !== 'impersonate' && input.character.post_history_instructions?.trim()) {
    parts.push(applyMacros(input.character.post_history_instructions.trim(), macros))
  }

  if (input.session.authorsNote?.trim()) {
    parts.push(`Author's Note:\n${applyMacros(input.session.authorsNote.trim(), macros)}`)
  }

  const speaker = mode === 'impersonate' ? userName : charName
  parts.push(applyMacros(firstPersonRule(speaker), macros))

  return parts.filter(Boolean).join('\n\n')
}

function messageVisibleText(m: ChatMessage): string {
  if (m.role === 'groupBeat') {
    const lines = activeBeatLines(m)
    return formatBeatForPrompt(lines) || m.text
  }
  if (m.role === 'assistant' && m.swipes?.length) {
    const idx = m.swipeIndex ?? 0
    return m.swipes[idx] ?? m.text
  }
  return m.text
}

export function selectHistory(
  messages: ChatMessage[],
  opts: { memoryCoveredCount?: number; tokenBudget?: number } = {},
): ChatMessage[] {
  const covered = opts.memoryCoveredCount ?? 0
  const budget = opts.tokenBudget ?? 6000
  const eligible = messages.slice(Math.min(covered, messages.length))

  const selected: ChatMessage[] = []
  let used = 0
  for (let i = eligible.length - 1; i >= 0; i--) {
    const m = eligible[i]!
    const cost = estimateTokens(messageVisibleText(m))
    if (selected.length && used + cost > budget) break
    selected.push(m)
    used += cost
  }
  return selected.reverse()
}

function historyToApiMessages(history: ChatMessage[]): {
  api: ChatApiMessage[]
  pendingDirector: string | null
} {
  const api: ChatApiMessage[] = []
  let pendingDirector: string | null = null
  let lastNarratorIndex = -1

  history.forEach((m, i) => {
    if (m.role === 'narrator') lastNarratorIndex = i
  })

  for (let i = 0; i < history.length; i++) {
    const m = history[i]!
    const text = messageVisibleText(m).trim()
    if (!text && m.role !== 'user') continue

    if (m.role === 'narrator') {
      api.push({
        role: 'system',
        content: formatNarratorBlock(text, i === lastNarratorIndex),
      })
      continue
    }
    if (m.role === 'director') {
      // Only the latest director note is injected late as mandatory override
      pendingDirector = text
      continue
    }
    if (m.role === 'groupBeat') {
      api.push({ role: 'assistant', content: text })
      continue
    }
    if (m.role === 'assistant') {
      const label = m.speakerName?.trim()
      const content = label && !text.startsWith(`${label}:`) ? `${label}: ${text}` : text
      api.push({ role: 'assistant', content })
      continue
    }
    api.push({ role: 'user', content: text || '(empty)' })
  }

  return { api, pendingDirector }
}

export function buildChatCompletionMessages(input: BuildPromptInput): BuiltPrompt {
  const mode = input.mode ?? 'normal'
  const userName = input.persona?.name ?? 'User'
  const lore = scanLorebooks(input.session.messages, input.loreBooks ?? [], {
    ...input.loreOptions,
    characterBook: input.character.character_book,
    characterId: input.character.id,
  })

  const systemPrompt = buildSystemPrompt(input, lore)
  const messages: ChatApiMessage[] = [{ role: 'system', content: systemPrompt }]

  if (input.session.memorySummary?.trim()) {
    messages.push({
      role: 'system',
      content: formatMemoryForPrompt(input.session.memorySummary),
    })
  }

  if (input.catchUpBlock?.trim()) {
    messages.push({ role: 'system', content: input.catchUpBlock.trim() })
  }

  const history = selectHistory(input.session.messages, {
    memoryCoveredCount: input.session.memoryCoveredCount,
    tokenBudget: input.historyTokenBudget,
  })
  const { api, pendingDirector } = historyToApiMessages(history)
  messages.push(...api)

  if (input.handoffNudge?.content) {
    messages.push(input.handoffNudge)
  }

  if (mode === 'continueScene') {
    messages.push({
      role: 'user',
      content: `(Continue. Write only the next reply as ${input.character.name}.)`,
    })
  }

  if (mode === 'impersonate') {
    messages.push({
      role: 'user',
      content: `(Write the next line as ${userName} only — first person. Do not write ${input.character.name}.)`,
    })
  }

  if (input.rewrite) {
    const rewritten = buildRewriteMessages({
      baseMessages: messages,
      currentReply: input.rewrite.currentReply,
      mode: input.rewrite.mode,
      customInstruction: input.rewrite.customInstruction,
      characterName: input.character.name,
    })
    return {
      messages: rewritten,
      lore,
      systemPrompt,
      postHistory: buildPostHistory(input),
    }
  }

  const postHistory = buildPostHistory(input)
  if (postHistory.trim()) {
    messages.push({ role: 'system', content: postHistory })
  }

  // Latest narrator scene law again for Impersonate (addressed to the player)
  if (mode === 'impersonate') {
    const lastNarrator = [...input.session.messages]
      .reverse()
      .find((m) => m.role === 'narrator' && m.text.trim())
    if (lastNarrator?.text.trim()) {
      messages.push({
        role: 'system',
        content: formatNarratorBlock(lastNarrator.text, true),
      })
    }
  }

  if (mode !== 'impersonate' && pendingDirector?.trim()) {
    messages.push({ role: 'system', content: formatDirectorBlock(pendingDirector) })
  }

  if (mode === 'impersonate') {
    messages.push({
      role: 'system',
      content: formatPlayerDirection(input.playerGuideNote, userName),
    })
  }

  return { messages, lore, systemPrompt, postHistory }
}

export function openingGreeting(character: Character, greetingIndex = 0): string {
  const alts = character.alternate_greetings ?? []
  if (greetingIndex > 0 && alts[greetingIndex - 1]) {
    return alts[greetingIndex - 1]!
  }
  return character.first_mes?.trim() || `*${character.name} looks at you.* "Hello."`
}
