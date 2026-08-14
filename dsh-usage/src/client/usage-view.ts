import type {
  ModelCostBreakdown, ModelCostDayBreakdown, ModelCostProjection, ModelCostRouteBreakdown,
} from '../types.js'

/** The token total displayed by both the footer and the Usage page. */
export function totalTokens(value: ModelCostBreakdown): number {
  return value.uncachedInputTokens
    + value.cacheWriteTokens
    + value.cacheReadTokens
    + value.outputTokens
}

/** Uncached input and cache-write input are the disjoint non-hit input bucket. */
export function inputTokens(value: ModelCostBreakdown): number {
  return value.uncachedInputTokens + value.cacheWriteTokens
}

/** Count model operations, including entered calls whose provider returned no usage. */
export function modelCalls(value: ModelCostBreakdown): number {
  return value.requests + value.usageUnavailableRequests
}

/** A cost is trustworthy only when every operation has usage and every usage sample has a rate. */
export function hasCompleteCost(value: ModelCostBreakdown): boolean {
  return value.requests > 0
    && value.unpricedRequests === 0
    && value.usageUnavailableRequests === 0
}

/** Session-level usage joined with the title carried by Harness's global session feed. */
export interface SessionUsageRow {
  id: string
  title: string
  usage: ModelCostProjection
}

/** Page aggregate over one or more replay-derived session projections. */
export interface UsageAggregate extends ModelCostBreakdown {
  currency: string | undefined
  byModel: ModelCostRouteBreakdown[]
  byDay: ModelCostDayBreakdown[]
}

const EMPTY_BREAKDOWN: ModelCostBreakdown = {
  requests: 0,
  unpricedRequests: 0,
  usageUnavailableRequests: 0,
  costNano: 0,
  uncachedInputTokens: 0,
  cacheReadTokens: 0,
  cacheWriteTokens: 0,
  outputTokens: 0,
}

function addBreakdown(target: ModelCostBreakdown, source: ModelCostBreakdown): void {
  target.requests += source.requests
  target.unpricedRequests += source.unpricedRequests
  target.usageUnavailableRequests += source.usageUnavailableRequests
  target.costNano += source.costNano
  target.uncachedInputTokens += source.uncachedInputTokens
  target.cacheReadTokens += source.cacheReadTokens
  target.cacheWriteTokens += source.cacheWriteTokens
  target.outputTokens += source.outputTokens
}

/** Fold selected sessions into one summary and one provider/model roster. */
export function aggregateUsage(rows: readonly SessionUsageRow[]): UsageAggregate {
  const result: UsageAggregate = {
    ...EMPTY_BREAKDOWN,
    currency: rows[0]?.usage.currency,
    byModel: [],
    byDay: [],
  }
  const models = new Map<string, ModelCostRouteBreakdown>()
  const days = new Map<string, ModelCostDayBreakdown>()
  for (const row of rows) {
    addBreakdown(result, row.usage)
    if (result.currency !== row.usage.currency) result.currency = undefined
    for (const model of row.usage.byModel) {
      const key = `${model.provider}\u0000${model.model}`
      let aggregate = models.get(key)
      if (aggregate === undefined) {
        aggregate = {
          provider: model.provider,
          model: model.model,
          ...EMPTY_BREAKDOWN,
        }
        models.set(key, aggregate)
      }
      addBreakdown(aggregate, model)
    }
    for (const day of row.usage.byDay) {
      let aggregate = days.get(day.day)
      if (aggregate === undefined) {
        aggregate = { day: day.day, ...EMPTY_BREAKDOWN }
        days.set(day.day, aggregate)
      }
      addBreakdown(aggregate, day)
    }
  }
  result.byModel = [...models.values()].sort((a, b) =>
    totalTokens(b) - totalTokens(a)
    || a.provider.localeCompare(b.provider)
    || a.model.localeCompare(b.model))
  result.byDay = [...days.values()].sort((a, b) => a.day.localeCompare(b.day))
  return result
}
