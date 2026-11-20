import { describe, expect, it } from 'vitest'
import {
  finalizeSummarizeOutput,
  formatMemorySummary,
  parseMemorySummary,
} from './memorySummary'

describe('memorySummary', () => {
  it('parses scene/ledger sections and pins', () => {
    const doc = parseMemorySummary(`## Scene
- Location: Rainy inn
- Present: Aria, Jay
## Ledger
- Thread: Who sent the letter?
- [pin] Secret: The ring is fake`)

    expect(doc.scene).toHaveLength(2)
    expect(doc.ledger).toHaveLength(2)
    expect(doc.ledger[1]?.pinned).toBe(true)
    expect(formatMemorySummary(doc)).toContain('[pin] Secret')
  })

  it('restores dropped pins after summarize', () => {
    const previous = parseMemorySummary(`## Ledger
- [pin] Secret: Keep this`)
    const finalized = finalizeSummarizeOutput(
      `## Scene
- Location: Road
## Ledger
- Thread: Travel north`,
      previous,
    )
    expect(finalized).toContain('[pin] Secret: Keep this')
    expect(finalized).toContain('Thread: Travel north')
  })
})
