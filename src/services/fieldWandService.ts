import { completeChat } from './nanogpt'
import { getApiKey, getChatModelId, getUseSubscription } from './settingsStore'
import { getSamplingSettings } from './generationSettings'

export type FieldWandExpansion = 'light' | 'medium' | 'deep'

export const FIELD_WAND_LABELS: Record<
  FieldWandExpansion,
  { title: string; subtitle: string; instruction: string }
> = {
  light: {
    title: 'Quick expand',
    subtitle: 'Add a few sentences from what is already on the card.',
    instruction:
      'Add only a SHORT addition (roughly 1–3 sentences). Do not repeat what is already in the field.',
  },
  medium: {
    title: 'More detail',
    subtitle: 'Add a solid paragraph of new relevant detail.',
    instruction:
      'Add a FULL PARAGRAPH of new relevant detail. Do not repeat existing wording unless needed for continuity.',
  },
  deep: {
    title: 'Deep fill',
    subtitle: 'Fill in everything implied — relationships, beats, texture.',
    instruction:
      'Add SUBSTANTIAL new detail — sensory specifics, relationships, history beats, speech quirks. Several short paragraphs are fine.',
  },
}

export async function expandCardField(opts: {
  fieldLabel: string
  currentValue: string
  cardContext: string
  expansion: FieldWandExpansion
  crossReferenceBlock?: string
}): Promise<string> {
  const apiKey = await getApiKey()
  const model = await getChatModelId()
  if (!apiKey || !model) {
    throw new Error('API key and default model required for field wand.')
  }
  const sampling = await getSamplingSettings()
  const meta = FIELD_WAND_LABELS[opts.expansion]
  const cross = opts.crossReferenceBlock?.trim()
  const reply = await completeChat({
    apiKey,
    model,
    useSubscription: await getUseSubscription(),
    temperature: Math.min(0.9, sampling.temperature + 0.05),
    top_p: sampling.topP,
    max_tokens: opts.expansion === 'deep' ? Math.max(1200, sampling.maxTokens) : sampling.maxTokens,
    messages: [
      {
        role: 'system',
        content:
          'You help fill character/persona card fields for private fiction. ' +
          'Return ONLY the full updated field text (existing content kept, plus your additions). ' +
          'No commentary, no markdown fences.',
      },
      {
        role: 'user',
        content: [
          `Field: ${opts.fieldLabel}`,
          meta.instruction,
          '',
          'Card context:',
          opts.cardContext || '(none)',
          cross ? `\nCross-reference source:\n${cross}` : '',
          '',
          'Current field value:',
          opts.currentValue || '(empty)',
          '',
          'Write the complete updated field value now.',
        ]
          .filter(Boolean)
          .join('\n'),
      },
    ],
  })
  return reply.trim()
}
