import { describe, expect, it } from 'vitest'
import {
  characterToStV2Json,
  exportCharacterPng,
  parseCharacterCardText,
  parseCharacterFromPng,
} from './characterCardCodec'
import { readCharaJsonFromPng } from './pngTextChunks'

describe('characterCardCodec', () => {
  it('parses ST V2 JSON and round-trips through PNG chara chunk', () => {
    const json = JSON.stringify({
      spec: 'chara_card_v2',
      spec_version: '2.0',
      data: {
        name: 'Mira',
        description: 'A mage',
        personality: 'Kind',
        scenario: 'Tower',
        first_mes: 'Hi',
        system_prompt: '',
        post_history_instructions: '',
        mes_example: '',
        alternate_greetings: ['Hey'],
        tags: ['fantasy'],
      },
    })

    const character = parseCharacterCardText(json)
    expect(character.name).toBe('Mira')
    expect(character.alternate_greetings).toEqual(['Hey'])

    const png = exportCharacterPng(character)
    const embedded = readCharaJsonFromPng(png)
    expect(embedded).toContain('Mira')

    const again = parseCharacterFromPng(png)
    expect(again.name).toBe('Mira')
    expect(again.description).toBe('A mage')

    const exported = characterToStV2Json(again)
    expect(exported).toContain('chara_card_v2')
  })

  it('parses flat V1-style cards', () => {
    const character = parseCharacterCardText(
      JSON.stringify({
        char_name: 'OldStyle',
        description: 'Legacy',
        first_mes: 'Yo',
      }),
    )
    expect(character.name).toBe('OldStyle')
    expect(character.first_mes).toBe('Yo')
  })
})
