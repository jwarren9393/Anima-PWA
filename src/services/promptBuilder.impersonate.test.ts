import { describe, expect, it } from 'vitest'
import { buildChatCompletionMessages } from './promptBuilder'
import type { Character, ChatSession } from '../models/types'

const character: Character = {
  id: 'c1',
  name: 'Aria',
  description: 'Traveler',
  post_history_instructions: 'Card post should skip on impersonate',
}

const session: ChatSession = {
  id: 's1',
  characterId: 'c1',
  messages: [
    { id: 'm1', role: 'user', text: 'Hi' },
    { id: 'm2', role: 'assistant', text: 'Hello' },
    { id: 'm3', role: 'narrator', text: 'Rain begins.' },
    { id: 'm4', role: 'director', text: 'Be cold.' },
  ],
}

describe('promptBuilder impersonate', () => {
  it('skips director, adds player guide, keeps first-person user lock', () => {
    const built = buildChatCompletionMessages({
      character,
      persona: { id: 'p1', name: 'Jay' },
      session,
      mode: 'impersonate',
      playerGuideNote: 'Sound curious',
    })

    const blob = built.messages.map((m) => m.content).join('\n')
    expect(blob).toContain('PLAYER GUIDE')
    expect(blob).toContain('Sound curious')
    expect(blob).toContain('Write ONLY as Jay')
    expect(blob).not.toContain('Director — mandatory')
    expect(built.postHistory).not.toContain('Card post should skip')
  })
})
