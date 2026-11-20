/**
 * Scene + Ledger memory document — one stored string on ChatSession.memorySummary.
 * Mirrors LEGACY_FLUTTER_REFERENCE.md §15.
 */

export type MemorySection = 'scene' | 'ledger'

export type MemoryLine = {
  section: MemorySection
  text: string
  pinned: boolean
}

export type MemorySummaryDocument = {
  scene: MemoryLine[]
  ledger: MemoryLine[]
}

const SCENE_PREFIXES = ['location:', 'present:', 'time:']
const LEDGER_PREFIXES = [
  'thread:',
  'promise:',
  'secret:',
  'relationship:',
  'goal:',
  'item:',
  'injury:',
  'event:',
]

function stripPin(raw: string): { text: string; pinned: boolean } {
  const trimmed = raw.trim().replace(/^[-*•]\s*/, '')
  if (trimmed.toLowerCase().startsWith('[pin]')) {
    return { text: trimmed.slice(5).trim(), pinned: true }
  }
  return { text: trimmed, pinned: false }
}

function classifyUnlabeled(text: string): MemorySection {
  const lower = text.toLowerCase()
  if (SCENE_PREFIXES.some((p) => lower.startsWith(p))) return 'scene'
  if (LEDGER_PREFIXES.some((p) => lower.startsWith(p))) return 'ledger'
  // Legacy unlabeled: Location/Present-ish → scene, else ledger
  if (/^(location|present|time)\b/i.test(text)) return 'scene'
  return 'ledger'
}

export function parseMemorySummary(raw: string | undefined | null): MemorySummaryDocument {
  const doc: MemorySummaryDocument = { scene: [], ledger: [] }
  if (!raw?.trim()) return doc

  let section: MemorySection | null = null
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim()
    if (!trimmed) continue
    if (/^##\s*scene\b/i.test(trimmed)) {
      section = 'scene'
      continue
    }
    if (/^##\s*ledger\b/i.test(trimmed)) {
      section = 'ledger'
      continue
    }
    const { text, pinned } = stripPin(trimmed)
    if (!text) continue
    const target = section ?? classifyUnlabeled(text)
    doc[target].push({ section: target, text, pinned })
  }
  return doc
}

export function formatMemorySummary(doc: MemorySummaryDocument): string {
  const parts: string[] = []
  if (doc.scene.length) {
    parts.push('## Scene')
    for (const line of doc.scene) {
      parts.push(line.pinned ? `- [pin] ${line.text}` : `- ${line.text}`)
    }
  }
  if (doc.ledger.length) {
    parts.push('## Ledger')
    for (const line of doc.ledger) {
      parts.push(line.pinned ? `- [pin] ${line.text}` : `- ${line.text}`)
    }
  }
  return parts.join('\n')
}

export function collectPinnedLedger(doc: MemorySummaryDocument): string[] {
  return doc.ledger.filter((l) => l.pinned).map((l) => l.text)
}

/** Restore [pin] markers the model may have dropped. */
export function finalizeSummarizeOutput(
  modelOutput: string,
  previous: MemorySummaryDocument,
): string {
  const next = parseMemorySummary(modelOutput)
  const pinned = collectPinnedLedger(previous)
  for (const pinText of pinned) {
    const existing = next.ledger.find(
      (l) => l.text.toLowerCase() === pinText.toLowerCase() || l.text.toLowerCase().includes(pinText.toLowerCase()),
    )
    if (existing) {
      existing.pinned = true
    } else {
      next.ledger.unshift({ section: 'ledger', text: pinText, pinned: true })
    }
  }
  return formatMemorySummary(next)
}

export const MEMORY_SUMMARIZE_SYSTEM = `You maintain a two-section story memory for a roleplay.

## Scene
Short bullets only: Location / Present / Time.
Replace Scene from the newest chat chunk. Carry forward Location/Present/Time if the chunk does not clearly change them.
Cap Scene at 10 bullets.

## Ledger
Durable facts: Thread / Promise / Secret / Relationship / Goal / Item / Injury / Event.
MERGE with the previous Ledger — do not rewrite from scratch. Newest does NOT win over older unresolved facts.
Keep unresolved Thread: lines until explicitly resolved.
Preserve any line that was marked [pin] — keep the [pin] marker.

Output format exactly:
## Scene
- Location: ...
- Present: ...
- Time: ...

## Ledger
- Thread: ...
- [pin] Secret: ...

Finish the last bullet. No commentary outside the two sections.`
