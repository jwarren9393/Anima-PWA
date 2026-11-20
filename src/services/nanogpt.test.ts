import { describe, it, expect } from 'vitest'
import {
  NanoGptCancelledException,
  filterModels,
  parseSseChatStream,
  type CatalogModel,
} from './nanogpt'

function sseStream(chunks: string[]): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder()
  let i = 0
  return new ReadableStream({
    pull(controller) {
      if (i >= chunks.length) {
        controller.close()
        return
      }
      controller.enqueue(encoder.encode(chunks[i]))
      i += 1
    },
  })
}

describe('NanoGPT SSE parsing', () => {
  it('assembles streamed deltas', async () => {
    const body = sseStream([
      'data: {"choices":[{"delta":{"content":"Hel"}}]}\n\n',
      'data: {"choices":[{"delta":{"content":"lo"}}]}\n\n',
      'data: [DONE]\n\n',
    ])
    const deltas: string[] = []
    const text = await parseSseChatStream(body, {
      onDelta: (chunk) => deltas.push(chunk),
    })
    expect(text).toBe('Hello')
    expect(deltas).toEqual(['Hel', 'lo'])
  })

  it('keeps partial text when aborted mid-stream', async () => {
    const controller = new AbortController()
    const encoder = new TextEncoder()
    let pullCount = 0

    const body = new ReadableStream<Uint8Array>({
      async pull(ctrl) {
        pullCount += 1
        if (pullCount === 1) {
          ctrl.enqueue(
            encoder.encode('data: {"choices":[{"delta":{"content":"Partial"}}]}\n\n'),
          )
          controller.abort()
          return
        }
        // After abort, further reads should still end
        ctrl.close()
      },
    })

    await expect(
      parseSseChatStream(body, { signal: controller.signal }),
    ).rejects.toBeInstanceOf(NanoGptCancelledException)

    try {
      await parseSseChatStream(
        sseStream([
          'data: {"choices":[{"delta":{"content":"Keep"}}]}\n\n',
          'data: {"choices":[{"delta":{"content":" me"}}]}\n\n',
        ]),
        {
          signal: AbortSignal.abort(),
        },
      )
      expect.fail('should have thrown')
    } catch (err) {
      expect(err).toBeInstanceOf(NanoGptCancelledException)
    }
  })

  it('stores cancellation partial on NanoGptCancelledException', async () => {
    const controller = new AbortController()
    const encoder = new TextEncoder()
    let step = 0

    const body = new ReadableStream<Uint8Array>({
      pull(ctrl) {
        step += 1
        if (step === 1) {
          ctrl.enqueue(
            encoder.encode('data: {"choices":[{"delta":{"content":"Stop here"}}]}\n\n'),
          )
          return
        }
        controller.abort()
        ctrl.enqueue(encoder.encode('data: {"choices":[{"delta":{"content":" more"}}]}\n\n'))
      },
    })

    try {
      await parseSseChatStream(body, { signal: controller.signal })
      expect.fail('expected cancel')
    } catch (err) {
      expect(err).toBeInstanceOf(NanoGptCancelledException)
      const cancel = err as NanoGptCancelledException
      expect(cancel.partialText).toContain('Stop here')
    }
  })
})

describe('filterModels', () => {
  const models: CatalogModel[] = [
    { id: 'openai/gpt', name: 'GPT', provider: 'openai', category: 'chat' },
    {
      id: 'x/uncensored-1',
      name: 'Uncensored',
      provider: 'x',
      description: 'derestricted',
    },
  ]

  it('filters by query, provider, favorites, and uncensored heuristic', () => {
    expect(filterModels(models, { query: 'gpt' })).toHaveLength(1)
    expect(filterModels(models, { provider: 'x' })[0]?.id).toBe('x/uncensored-1')
    expect(
      filterModels(models, { favoriteIds: new Set(['openai/gpt']) }),
    ).toHaveLength(1)
    expect(filterModels(models, { category: 'uncensored' })[0]?.id).toBe(
      'x/uncensored-1',
    )
  })
})
