/**
 * Strips a leading "SpeakerName:" style label from AI reply text.
 * Group chats already show the speaker on the bubble.
 */

export function stripLeadingSpeakerPrefix(text: string, speakerName?: string | null): string {
  const name = speakerName?.trim() ?? ''
  if (!name || !text) return text

  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const pattern = new RegExp(
    `^\\s*(?:` +
      `(?:\\*{1,2}|_{1,2})${escaped}\\s*[:：\\-–—](?:\\*{1,2}|_{1,2})\\s*` +
      `|` +
      `(?:\\*{1,2}|_{1,2})?${escaped}(?:\\*{1,2}|_{1,2})?\\s*[:：\\-–—]\\s*` +
      `)`,
    'i',
  )
  const stripped = text.replace(pattern, '')
  if (!stripped) {
    if (pattern.test(text)) return ''
    return text
  }
  return stripped
}

export function stripLeadingCastPrefix(text: string, castNames: Iterable<string>): string {
  for (const name of castNames) {
    const trimmed = name.trim()
    if (!trimmed) continue
    const stripped = stripLeadingSpeakerPrefix(text, trimmed)
    if (stripped !== text) return stripped
  }
  return text
}
