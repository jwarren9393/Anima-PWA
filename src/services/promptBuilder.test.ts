import { describe, expect, it } from 'vitest'
import {
  ANIMA_DEFAULT_SEED,
  buildChatCompletionMessages,
  buildSystemPrompt,
  selectHistory,
} from './promptBuilder'
import { scanLorebooks } from './lorebookService'
import type { Character, ChatSession } from '../models/types'

const character: Character = {
  id: 'c1',
  name: 'Aria',
  description: 'A traveler',
  personality: 'Curious',
  scenario: 'A rainy inn',
  first_mes: 'Hello.',
  system_prompt: 'You are {{char}} speaking with {{user}}.',
  post_history_instructions: 'Keep replies short.',
  mes_example: '{{char}}: "Hi."',
}

const session: ChatSession = {
  id: 's1',
  characterId: 'c1',
  authorsNote: 'Tension rising.',
  messages: [
    { id: 'm1', role: 'user', text: 'Hello Aria' },
    { id: 'm2', role: 'assistant', text: 'Hello there.', swipes: ['Hello there.'], swipeIndex: 0 },
    { id: 'm3', role: 'director', text: 'Mention the storm.' },
  ],
}

describe('promptBuilder', () => {
  it('assembles system → history → post-history → director late block', () => {
    const built = buildChatCompletionMessages({
      character,
      persona: { id: 'p1', name: 'Jay', identity: 'A writer' },
      session,
      globalSystemPrompt: 'Global sys',
      globalPostHistory: 'Global post',
      loreBooks: [],
    })

    expect(built.messages[0]?.role).toBe('system')
    expect(built.systemPrompt).toContain('Aria')
    expect(built.systemPrompt).toContain('Jay')
    expect(built.systemPrompt).toContain('Global sys')
    expect(built.systemPrompt).toContain('traveler')

    const roles = built.messages.map((m) => m.role)
    expect(roles).toContain('user')
    expect(roles).toContain('assistant')

    const last = built.messages[built.messages.length - 1]
    expect(last?.role).toBe('system')
    expect(last?.content).toContain('Director')
    expect(last?.content).toContain('storm')

    expect(built.postHistory).toContain("Author's Note")
    expect(built.postHistory).toContain('Global post')
    expect(built.postHistory).toContain('first person')
  })

  it('applies macros and default seed', () => {
    const lore = scanLorebooks([], [], {})
    const system = buildSystemPrompt(
      {
        character: { ...character, system_prompt: '' },
        session,
      },
      lore,
    )
    expect(system).toContain('Aria')
    expect(ANIMA_DEFAULT_SEED).toContain('{{char}}')
  })

  it('selectHistory respects token budget from the end', () => {
    const msgs = Array.from({ length: 20 }, (_, i) => ({
      id: `m${i}`,
      role: i % 2 === 0 ? ('user' as const) : ('assistant' as const),
      text: 'word '.repeat(50),
    }))
    const selected = selectHistory(msgs, { tokenBudget: 80 })
    expect(selected.length).toBeGreaterThan(0)
    expect(selected.length).toBeLessThan(msgs.length)
    expect(selected.at(-1)?.id).toBe('m19')
  })
})
