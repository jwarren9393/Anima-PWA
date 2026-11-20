import { describe, expect, it } from 'vitest'
import { normalizeUserPerspective, parsePathOptions } from './roadwayService'

describe('roadwayService', () => {
  it('parses numbered path options and normalizes persona leaks', () => {
    const raw = `1. *I open the door* "Hello?"
2. *Jay steps back* "Wait."
3. I stay silent.`
    const opts = parsePathOptions(raw, 'Jay')
    expect(opts.length).toBeGreaterThanOrEqual(2)
    expect(opts.some((o) => o.includes('*I') || o.toLowerCase().includes('i '))).toBe(true)
    expect(normalizeUserPerspective('*Jay waves*', 'Jay')).toBe('*I waves*')
  })
})
