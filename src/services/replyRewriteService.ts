import type { ChatApiMessage } from './nanogpt'

export type RewriteMode =
  | 'fix'
  | 'shorter'
  | 'longer'
  | 'more_in_character'
  | 'less_purple'
  | 'custom'

export const REWRITE_MODE_LABELS: Record<RewriteMode, string> = {
  fix: 'Fix / clean up',
  shorter: 'Make shorter',
  longer: 'Make longer',
  more_in_character: 'More in character',
  less_purple: 'Less purple prose',
  custom: 'Custom instruction',
}

export function buildRewriteMessages(opts: {
  baseMessages: ChatApiMessage[]
  currentReply: string
  mode: RewriteMode
  customInstruction?: string
  characterName: string
}): ChatApiMessage[] {
  const instruction = rewriteInstruction(opts.mode, opts.customInstruction, opts.characterName)
  return [
    ...opts.baseMessages,
    {
      role: 'assistant',
      content: opts.currentReply,
    },
    {
      role: 'user',
      content: `(Rewrite your last reply. ${instruction} Output only the rewritten reply as ${opts.characterName}.)`,
    },
  ]
}

function rewriteInstruction(
  mode: RewriteMode,
  custom: string | undefined,
  charName: string,
): string {
  switch (mode) {
    case 'fix':
      return 'Fix grammar, clarity, and continuity issues without changing the intent.'
    case 'shorter':
      return 'Make it noticeably shorter while keeping the same beats.'
    case 'longer':
      return 'Expand with richer sensory detail and pacing; stay as ' + charName + '.'
    case 'more_in_character':
      return `Lean harder into ${charName}'s voice, mannerisms, and established personality.`
    case 'less_purple':
      return 'Tone down purple prose and melodrama; keep it vivid but grounded.'
    case 'custom':
      return custom?.trim() || 'Improve the reply.'
  }
}
