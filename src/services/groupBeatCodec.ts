import type { GroupBeatPart } from '../models/types'

export function flattenBeat(lines: GroupBeatPart[]): string {
  const out: string[] = []
  for (const line of lines) {
    const name = line.speakerName.trim()
    const text = line.text.trim()
    if (!name || !text) continue
    out.push(`${name}: ${text}`)
  }
  return out.join('\n')
}

export function formatBeatForPrompt(lines: GroupBeatPart[]): string {
  const body = flattenBeat(lines)
  if (!body) return ''
  return `Group moment (simultaneous reactions):\n${body}`
}

export function encodeBeatSwipe(lines: GroupBeatPart[]): string {
  return JSON.stringify(lines)
}

export function decodeBeatSwipe(raw: string): GroupBeatPart[] {
  const trimmed = raw.trim()
  if (!trimmed) return []
  try {
    const decoded = JSON.parse(trimmed) as unknown
    if (!Array.isArray(decoded)) return []
    return decoded
      .map((e) => {
        const row = e as Record<string, unknown>
        return {
          speakerId: String(row.speakerId ?? '').trim(),
          speakerName: String(row.speakerName ?? '').trim(),
          text: String(row.text ?? '').trim(),
        }
      })
      .filter((p) => p.text.length > 0)
  } catch {
    return []
  }
}

export function encodeAllBeatSwipes(variants: GroupBeatPart[][]): string[] {
  return variants.map(encodeBeatSwipe)
}

export function decodeAllBeatSwipes(swipes: string[]): GroupBeatPart[][] {
  return swipes.map(decodeBeatSwipe).filter((s) => s.length > 0)
}

export function activeBeatLines(opts: {
  beatLines?: GroupBeatPart[]
  beatSwipes?: GroupBeatPart[][]
  swipes?: string[]
  swipeIndex?: number
}): GroupBeatPart[] {
  if (opts.beatSwipes?.length) {
    const idx = Math.min(
      Math.max(0, opts.swipeIndex ?? 0),
      opts.beatSwipes.length - 1,
    )
    return opts.beatSwipes[idx] ?? opts.beatLines ?? []
  }
  if (opts.swipes?.length) {
    const decoded = decodeAllBeatSwipes(opts.swipes)
    if (decoded.length) {
      const idx = Math.min(Math.max(0, opts.swipeIndex ?? 0), decoded.length - 1)
      return decoded[idx] ?? []
    }
  }
  return opts.beatLines ?? []
}
