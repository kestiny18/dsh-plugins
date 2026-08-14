import { describe, expect, it } from 'vitest'
import { aggregateUsage, hasCompleteCost, inputTokens, modelCalls, totalTokens } from '../src/client/usage-view.js'
import type { ModelCostProjection } from '../src/types.js'

function projection(overrides: Partial<ModelCostProjection> = {}): ModelCostProjection {
  return {
    currency: 'USD',
    requests: 1,
    unpricedRequests: 0,
    usageUnavailableRequests: 0,
    costNano: 120_000,
    uncachedInputTokens: 10,
    cacheReadTokens: 20,
    cacheWriteTokens: 2,
    outputTokens: 5,
    byModel: [{
      provider: 'p', model: 'm', requests: 1, unpricedRequests: 0,
      usageUnavailableRequests: 0, costNano: 120_000,
      uncachedInputTokens: 10, cacheReadTokens: 20, cacheWriteTokens: 2, outputTokens: 5,
    }],
    byPurpose: [],
    byTurn: [],
    byDay: [{
      day: '2026-08-14', requests: 1, unpricedRequests: 0,
      usageUnavailableRequests: 0, costNano: 120_000,
      uncachedInputTokens: 10, cacheReadTokens: 20, cacheWriteTokens: 2, outputTokens: 5,
    }],
    ...overrides,
  }
}

describe('Usage page derivation', () => {
  it('aggregates sessions and model routes without overlapping token buckets', () => {
    const result = aggregateUsage([
      { id: 'a', title: 'A', usage: projection() },
      { id: 'b', title: 'B', usage: projection({ costNano: 80_000 }) },
    ])

    expect(totalTokens(result)).toBe(74)
    expect(inputTokens(result)).toBe(24)
    expect(modelCalls(result)).toBe(2)
    expect(result.costNano).toBe(200_000)
    expect(result.byModel).toEqual([expect.objectContaining({ provider: 'p', model: 'm', requests: 2 })])
    expect(result.byDay).toEqual([expect.objectContaining({ day: '2026-08-14', requests: 2 })])
    expect(hasCompleteCost(result)).toBe(true)
  })

  it('marks aggregate cost unavailable for coverage or currency gaps', () => {
    const incomplete = aggregateUsage([
      { id: 'a', title: 'A', usage: projection() },
      { id: 'b', title: 'B', usage: projection({ unpricedRequests: 1 }) },
    ])
    expect(hasCompleteCost(incomplete)).toBe(false)

    const mixedCurrency = aggregateUsage([
      { id: 'a', title: 'A', usage: projection() },
      { id: 'b', title: 'B', usage: projection({ currency: 'CNY' }) },
    ])
    expect(mixedCurrency.currency).toBeUndefined()
  })
})
