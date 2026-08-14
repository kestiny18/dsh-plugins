import { describe, expect, it } from 'vitest'
import type { SessionEvent } from '@deepseek-ai/dsh-session'
import type {} from '@deepseek-ai/dsh-compaction/types'
import { createAssistantMessage } from '@deepseek-ai/dsh-llm/message'
import { resolveConfig } from '../src/pricing.js'
import { createModelCostProjection } from '../src/projection.js'

const config = resolveConfig({
  currency: 'USD',
  rates: [
    { provider: 'p', model: 'main', uncachedInput: 1, cacheRead: 0.1, cacheWrite: 2, output: 3 },
    { provider: 'p', model: 'compact', uncachedInput: 2, cacheRead: 0.2, cacheWrite: 4, output: 6 },
  ],
})

function event<T extends SessionEvent['type']>(
  type: T,
  seq: number,
  data: Extract<SessionEvent, { type: T }>['data'],
  time = 1_800_000_000_000,
): Extract<SessionEvent, { type: T }> {
  return { type, seq, time, data } as Extract<SessionEvent, { type: T }>
}

describe('model cost projection', () => {
  it('replaces an early usage chunk with the final sample for one agent step', () => {
    const projection = createModelCostProjection(config)
    let state = projection.init()
    const events = [
      event('step/start', 0, { turn: 1, step: 1 }),
      event('request/header', 1, { header: { config: { provider: 'p', model: 'main' } }, reason: 'initial' }),
      event('assistant/chunk', 2, { turn: 1, step: 1, chunk: { type: 'usage', usage: { inputTokens: 10, outputTokens: 5 } } }),
      event('assistant/message', 3, {
        turn: 1,
        step: 1,
        message: createAssistantMessage({ content: [], source: { provider: 'p', model: 'main' } }),
        usage: { inputTokens: 12, cacheReadTokens: 8, outputTokens: 6 },
      }),
      event('step/end', 4, { turn: 1, step: 1 }),
    ] satisfies SessionEvent[]
    for (const item of events) state = projection.apply(state, item)
    expect(projection.view(state)).toMatchObject({
      currency: 'USD',
      requests: 1,
      unpricedRequests: 0,
      usageUnavailableRequests: 0,
      uncachedInputTokens: 12,
      cacheReadTokens: 8,
      outputTokens: 6,
      costNano: 30_800,
      byModel: [{ provider: 'p', model: 'main', requests: 1 }],
      byTurn: [{
        turn: 1,
        requests: 1,
        uncachedInputTokens: 12,
        cacheReadTokens: 8,
        outputTokens: 6,
      }],
      byDay: [{
        day: new Date(1_800_000_000_000).toISOString().slice(0, 10),
        requests: 1,
        uncachedInputTokens: 12,
        cacheReadTokens: 8,
        outputTokens: 6,
      }],
    })
  })

  it('adds compaction usage and reports unpriced and usage-unavailable calls', () => {
    const projection = createModelCostProjection(config)
    let state = projection.init()
    const events = [
      event('step/start', 0, { turn: 1, step: 1 }),
      event('request/header', 1, { header: { config: { provider: 'p', model: 'unknown' } }, reason: 'initial' }),
      event('assistant/message', 2, {
        turn: 1,
        step: 1,
        message: createAssistantMessage({ content: [], source: { provider: 'p', model: 'unknown' } }),
        usage: { inputTokens: 10, outputTokens: 2 },
      }),
      event('step/end', 3, { turn: 1, step: 1 }),
      event('step/start', 4, { turn: 2, step: 1 }),
      event('request/header', 5, { header: { config: { provider: 'p', model: 'main' } }, reason: 'change' }),
      event('step/end', 6, { turn: 2, step: 1 }),
      event('compaction/summary', 7, {
        compactionId: 'compaction-1' as never,
        summary: [],
        shadowedRange: { start: 0, end: 0 },
        shadowedSeqs: [0],
        shadowedTokenCount: 1,
        provider: 'p',
        model: 'compact',
        usage: { inputTokens: 20, cacheReadTokens: 10, outputTokens: 4 },
      }),
    ] satisfies SessionEvent[]
    for (const item of events) state = projection.apply(state, item)
    const value = projection.view(state)
    expect(value).toMatchObject({
      requests: 2,
      unpricedRequests: 1,
      usageUnavailableRequests: 1,
      costNano: 66_000,
    })
    expect(value.byPurpose).toEqual([
      expect.objectContaining({ purpose: 'agent', requests: 1, unpricedRequests: 1, usageUnavailableRequests: 1 }),
      expect.objectContaining({ purpose: 'compaction', requests: 1, costNano: 66_000 }),
    ])
    expect(value.byTurn).toEqual([
      expect.objectContaining({ turn: 1, requests: 1, usageUnavailableRequests: 0 }),
      expect.objectContaining({ turn: 2, requests: 0, usageUnavailableRequests: 1 }),
    ])
    expect(value.byDay).toEqual([
      expect.objectContaining({
        day: new Date(1_800_000_000_000).toISOString().slice(0, 10),
        requests: 2,
        unpricedRequests: 1,
        usageUnavailableRequests: 1,
      }),
    ])
  })
})
