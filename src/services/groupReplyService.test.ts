import { describe, expect, it } from 'vitest'
import type { Character } from '../models/types'
import { parseBeatReply, linesToBeatParts } from './groupReplyService'
import { flattenBeat } from './groupBeatCodec'
import { buildCatchUpBlock } from './presenceService'

function char(id: string, name: string): Character {
  return { id, name }
}

describe('parseBeatReply', () => {
  it('parses Name: lines in speaker order', () => {
    const emma = char('e', 'Emma')
    const madison = char('m', 'Madison')
    const lines = parseBeatReply(
      'Emma: *smiles* "Hey."\nMadison: *nods* "Hi."\n',
      [emma, madison],
    )
    expect(lines.map((l) => l.character.id)).toEqual(['e', 'm'])
    expect(flattenBeat(linesToBeatParts(lines))).toContain('Emma:')
  })
})

describe('buildCatchUpBlock', () => {
  it('summarizes pre-join messages', () => {
    const block = buildCatchUpBlock({
      userName: 'Jay',
      joinIndex: 2,
      messages: [
        { id: '1', role: 'user', text: 'Hello room' },
        {
          id: '2',
          role: 'assistant',
          text: 'Welcome',
          speakerName: 'Emma',
        },
        { id: '3', role: 'user', text: 'after join' },
      ],
    })
    expect(block).toContain('You just entered')
    expect(block).toContain('Hello room')
    expect(block).toContain('Emma')
  })
})
