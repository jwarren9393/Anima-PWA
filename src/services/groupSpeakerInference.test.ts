import { describe, expect, it } from 'vitest'
import type { Character, ChatMessage } from '../models/types'
import {
  buildHandoffNudge,
  resolveGroupSpeaker,
} from './groupSpeakerInference'
import {
  stripLeadingCastPrefix,
  stripLeadingSpeakerPrefix,
} from './speakerPrefix'

function char(id: string, name: string): Character {
  return { id, name }
}

describe('resolveGroupSpeaker', () => {
  it('continues last assistant speaker', () => {
    const emma = char('e', 'Emma')
    const madison = char('m', 'Madison')
    const messages: ChatMessage[] = [
      {
        id: '1',
        role: 'assistant',
        text: 'Hi',
        speakerId: emma.id,
        speakerName: emma.name,
      },
    ]
    const pick = resolveGroupSpeaker({
      participants: [emma, madison],
      messages,
      primaryCharacter: madison,
    })
    expect(pick.id).toBe('e')
  })

  it('after user message prefers name mention then last speaker', () => {
    const emma = char('e', 'Emma')
    const madison = char('m', 'Madison')
    const messages: ChatMessage[] = [
      {
        id: '1',
        role: 'assistant',
        text: 'Hey',
        speakerId: emma.id,
        speakerName: emma.name,
      },
      { id: '2', role: 'user', text: 'Madison, what do you think?' },
    ]
    const pick = resolveGroupSpeaker({
      participants: [emma, madison],
      messages,
    })
    expect(pick.id).toBe('m')
  })

  it('after user message without mention uses last assistant', () => {
    const emma = char('e', 'Emma')
    const madison = char('m', 'Madison')
    const messages: ChatMessage[] = [
      {
        id: '1',
        role: 'assistant',
        text: 'Hey',
        speakerId: emma.id,
        speakerName: emma.name,
      },
      { id: '2', role: 'user', text: 'Sure, sounds good.' },
    ]
    const pick = resolveGroupSpeaker({
      participants: [emma, madison],
      messages,
    })
    expect(pick.id).toBe('e')
  })
})

describe('buildHandoffNudge', () => {
  it('nudges after another assistant spoke', () => {
    const emma = char('e', 'Emma')
    const madison = char('m', 'Madison')
    const messages: ChatMessage[] = [
      {
        id: '1',
        role: 'assistant',
        text: 'Hey',
        speakerId: emma.id,
        speakerName: emma.name,
      },
    ]
    const nudge = buildHandoffNudge({
      messages,
      endExclusive: messages.length,
      target: madison,
    })
    expect(nudge).not.toBeNull()
    expect(nudge!.content).toContain('Emma')
    expect(nudge!.content).toContain('Madison')
  })

  it('skips when target already spoke last', () => {
    const emma = char('e', 'Emma')
    const messages: ChatMessage[] = [
      {
        id: '1',
        role: 'assistant',
        text: 'Hey',
        speakerId: emma.id,
        speakerName: emma.name,
      },
    ]
    const nudge = buildHandoffNudge({
      messages,
      endExclusive: messages.length,
      target: emma,
    })
    expect(nudge).toBeNull()
  })
})

describe('speakerPrefix', () => {
  it('strips Name: prefix', () => {
    expect(stripLeadingSpeakerPrefix('Emma: Hello there', 'Emma')).toBe('Hello there')
    expect(stripLeadingSpeakerPrefix('**Emma:** Hi', 'Emma')).toBe('Hi')
  })

  it('strips first matching cast name', () => {
    expect(stripLeadingCastPrefix('Madison: Yo', ['Emma', 'Madison'])).toBe('Yo')
  })
})
