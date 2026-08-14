import type { TokenUsage } from '@deepseek-ai/dsh-llm'
import type { ModelCostConfig, ModelCostTokenBuckets, ModelRateConfig } from './types.js'

const DEFAULT_EFFECTIVE_FROM = '1970-01-01T00:00:00.000Z'
const CURRENCY = /^[A-Z]{3}$/u

/** Validated price schedule used by the replay fold. */
export interface ResolvedModelRate extends Required<ModelRateConfig> {
  effectiveFromMs: number
}

/** Detached, normalized plugin configuration. */
export interface ResolvedModelCostConfig {
  currency: string
  rates: readonly ResolvedModelRate[]
  stateVersion: number
}

/** Convert provider usage into the Harness four-bucket accounting vocabulary. */
export function bucketsFromUsage(usage: TokenUsage): ModelCostTokenBuckets {
  return {
    uncachedInputTokens: usage.inputTokens,
    cacheReadTokens: usage.cacheReadTokens ?? 0,
    cacheWriteTokens: usage.cacheWriteTokens ?? 0,
    outputTokens: usage.outputTokens,
  }
}

/** Calculate a bucketed charge in billionths of the configured currency unit. */
export function chargeNano(buckets: ModelCostTokenBuckets, rate: ResolvedModelRate): number {
  const value = Math.round(
    (buckets.uncachedInputTokens * rate.uncachedInput
      + buckets.cacheReadTokens * rate.cacheRead
      + buckets.cacheWriteTokens * rate.cacheWrite
      + buckets.outputTokens * rate.output) * 1_000,
  )
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new Error('dsh-usage: calculated charge exceeds the safe integer range')
  }
  return value
}

/** Resolve the latest exact route schedule effective at an event timestamp. */
export function findRate(
  config: ResolvedModelCostConfig,
  provider: string,
  model: string,
  time: number,
): ResolvedModelRate | undefined {
  let selected: ResolvedModelRate | undefined
  for (const rate of config.rates) {
    if (rate.provider !== provider || rate.model !== model || rate.effectiveFromMs > time) continue
    if (selected === undefined || rate.effectiveFromMs > selected.effectiveFromMs) selected = rate
  }
  return selected
}

/** Validate human-owned schedules and derive projection-cache invalidation. */
export function resolveConfig(config: ModelCostConfig): ResolvedModelCostConfig {
  const currency = config.currency.trim().toUpperCase()
  if (!CURRENCY.test(currency)) {
    throw new Error('dsh-usage: currency must be a three-letter code such as USD or CNY')
  }
  if (config.rates.length === 0) throw new Error('dsh-usage: rates must contain at least one schedule')

  const seen = new Set<string>()
  const rates = config.rates.map((candidate, index): ResolvedModelRate => {
    const provider = candidate.provider.trim()
    const model = candidate.model.trim()
    if (provider.length === 0 || model.length === 0) {
      throw new Error(`dsh-usage: rates[${String(index)}] provider and model must be non-empty`)
    }
    const effectiveFrom = candidate.effectiveFrom ?? DEFAULT_EFFECTIVE_FROM
    const effectiveFromMs = Date.parse(effectiveFrom)
    if (!Number.isFinite(effectiveFromMs) || new Date(effectiveFromMs).toISOString() !== effectiveFrom) {
      throw new Error(`dsh-usage: rates[${String(index)}].effectiveFrom must be an ISO UTC instant`)
    }
    for (const field of ['uncachedInput', 'cacheRead', 'cacheWrite', 'output'] as const) {
      const value = candidate[field]
      if (!Number.isFinite(value) || value < 0) {
        throw new Error(`dsh-usage: rates[${String(index)}].${field} must be a finite non-negative number`)
      }
    }
    const identity = JSON.stringify([provider, model, effectiveFrom])
    if (seen.has(identity)) {
      throw new Error(`dsh-usage: duplicate schedule for ${provider}/${model} at ${effectiveFrom}`)
    }
    seen.add(identity)
    return { ...candidate, provider, model, effectiveFrom, effectiveFromMs }
  }).sort((left, right) => left.effectiveFromMs - right.effectiveFromMs
    || left.provider.localeCompare(right.provider)
    || left.model.localeCompare(right.model))

  // v3 adds daily buckets to the persisted projection state.
  const canonical = JSON.stringify({ semanticVersion: 3, currency, rates })
  return Object.freeze({
    currency,
    rates: Object.freeze(rates.map(rate => Object.freeze(rate))),
    stateVersion: fnv1a(canonical),
  })
}

/** Stable 32-bit cache version derived from code semantics and normalized rates. */
function fnv1a(value: string): number {
  let hash = 0x811c9dc5
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index)
    hash = Math.imul(hash, 0x01000193)
  }
  return hash >>> 0
}
