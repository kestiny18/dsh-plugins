import { describe, expect, it } from 'vitest'
import { bucketsFromUsage, chargeNano, findRate, resolveConfig } from '../src/pricing.js'

describe('pricing', () => {
  it('prices the four disjoint usage buckets in nano currency units', () => {
    const config = resolveConfig({
      currency: 'usd',
      rates: [{
        provider: 'deepseek-official',
        model: 'deepseek-v4-flash',
        uncachedInput: 0.14,
        cacheRead: 0.0028,
        cacheWrite: 0.14,
        output: 0.28,
      }],
    })
    const rate = findRate(config, 'deepseek-official', 'deepseek-v4-flash', Date.now())
    expect(rate).toBeDefined()
    const buckets = bucketsFromUsage({
      inputTokens: 1_000,
      cacheReadTokens: 2_000,
      cacheWriteTokens: 300,
      outputTokens: 500,
      reasoningTokens: 250,
    })
    expect(chargeNano(buckets, rate!)).toBe(327_600)
  })

  it('selects the latest schedule effective at the event time', () => {
    const config = resolveConfig({
      currency: 'USD',
      rates: [
        { provider: 'p', model: 'm', effectiveFrom: '2026-01-01T00:00:00.000Z', uncachedInput: 1, cacheRead: 1, cacheWrite: 1, output: 1 },
        { provider: 'p', model: 'm', effectiveFrom: '2026-06-01T00:00:00.000Z', uncachedInput: 2, cacheRead: 2, cacheWrite: 2, output: 2 },
      ],
    })
    expect(findRate(config, 'p', 'm', Date.parse('2026-05-01T00:00:00.000Z'))?.uncachedInput).toBe(1)
    expect(findRate(config, 'p', 'm', Date.parse('2026-07-01T00:00:00.000Z'))?.uncachedInput).toBe(2)
  })

  it('rejects ambiguous or malformed schedules', () => {
    const rate = { provider: 'p', model: 'm', uncachedInput: 1, cacheRead: 1, cacheWrite: 1, output: 1 }
    expect(() => resolveConfig({ currency: 'US', rates: [rate] })).toThrow(/three-letter/)
    expect(() => resolveConfig({ currency: 'USD', rates: [] })).toThrow(/at least one/)
    expect(() => resolveConfig({ currency: 'USD', rates: [rate, rate] })).toThrow(/duplicate/)
    expect(() => resolveConfig({
      currency: 'USD',
      rates: [{ ...rate, effectiveFrom: '2026-01-01' }],
    })).toThrow(/ISO UTC/)
  })
})
