import { describe, expect, it } from 'vitest'
import { scanLorebooks } from './lorebookService'
import type { GlobalLorebook } from '../models/types'

const book: GlobalLorebook = {
  id: 'lore1',
  name: 'World',
  enabled: true,
  book: {
    entries: [
      {
        id: 'e1',
        keys: ['Crystal Spire'],
        content: 'The Crystal Spire glows at dusk.',
        comment: 'Spire',
        position: 'before_char',
        priority: 20,
      },
      {
        id: 'e2',
        keys: ['nevermatchzzz'],
        content: 'Should not trigger',
        comment: 'Miss',
        position: 'after_char',
        priority: 50,
      },
      {
        id: 'e3',
        keys: ['glow'],
        content: 'Glow lore after',
        comment: 'Glow',
        position: 'after_char',
        constant: false,
        priority: 5,
      },
      {
        id: 'e4',
        keys: [],
        content: 'Always on',
        comment: 'Const',
        constant: true,
        position: 'before_char',
        priority: 1,
      },
    ],
  },
}

describe('scanLorebooks', () => {
  it('matches keywords in recent messages and respects budget/priority', () => {
    const result = scanLorebooks(
      [
        { id: '1', role: 'user', text: 'We approach the Crystal Spire.' },
        { id: '2', role: 'assistant', text: 'It begins to glow.' },
      ],
      [book],
      { scanDepth: 4, tokenBudget: 200, recursive: false },
    )

    expect(result.triggeredLabels).toContain('Spire')
    expect(result.triggeredLabels).toContain('Const')
    expect(result.triggeredLabels).not.toContain('Miss')
    expect(result.beforeChar.some((h) => h.label === 'Spire')).toBe(true)
  })

  it('recursive scan can trigger from matched content', () => {
    const recursiveBook: GlobalLorebook = {
      id: 'r1',
      name: 'R',
      enabled: true,
      book: {
        entries: [
          {
            id: 'a',
            keys: ['apple'],
            content: 'Mentions banana fruit.',
            comment: 'Apple',
            position: 'before_char',
            priority: 10,
          },
          {
            id: 'b',
            keys: ['banana'],
            content: 'Banana lore unlocked.',
            comment: 'Banana',
            position: 'after_char',
            priority: 10,
          },
        ],
      },
    }

    const result = scanLorebooks(
      [{ id: '1', role: 'user', text: 'I eat an apple.' }],
      [recursiveBook],
      { recursive: true, tokenBudget: 500 },
    )

    expect(result.triggeredLabels).toContain('Apple')
    expect(result.triggeredLabels).toContain('Banana')
  })
})
