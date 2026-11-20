/** Rough token estimate used for lore budget / context trimming (≈4 chars/token). */
export function estimateTokens(text: string): number {
  if (!text) return 0
  return Math.max(1, Math.ceil(text.length / 4))
}
