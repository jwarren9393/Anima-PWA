import { describe, expect, it } from 'vitest'
import {
  formatPersonaPromptBlock,
  parsePersonaCardText,
  personaToJson,
} from './personaCardCodec'

describe('personaCardCodec', () => {
  it('parses Anima and AI-written persona shapes', () => {
    const a = parsePersonaCardText(
      JSON.stringify({
        name: 'Jay',
        identity: 'Storyteller',
        appearance: 'Tall',
        goals: 'Explore',
      }),
    )
    expect(a.name).toBe('Jay')
    expect(formatPersonaPromptBlock(a)).toContain('Storyteller')

    const b = parsePersonaCardText(
      JSON.stringify({
        name: 'Alex',
        looks: 'Short hair',
        backstory: 'From the coast',
        motivations: 'Find home',
      }),
    )
    expect(b.appearance).toContain('Short hair')
    expect(b.background).toContain('coast')
    expect(b.goals).toContain('Find home')

    const round = parsePersonaCardText(personaToJson(a))
    expect(round.name).toBe('Jay')
  })
})
