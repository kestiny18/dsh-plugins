/** Public configuration and projection types for model usage and cost accounting. */

/** A model price schedule, expressed in one currency unit per million tokens. */
export interface ModelRateConfig {
  /** Exact Harness provider route. */
  provider: string
  /** Exact provider-owned model id. */
  model: string
  /** Inclusive UTC instant at which this schedule starts. */
  effectiveFrom?: string
  /** Price of one million uncached input tokens. */
  uncachedInput: number
  /** Price of one million cache-read tokens. */
  cacheRead: number
  /** Price of one million cache-write tokens. */
  cacheWrite: number
  /** Price of one million output tokens; reasoning is already included. */
  output: number
}

/** Model-cost plugin configuration. */
export interface ModelCostConfig {
  /** Three-letter currency code shared by every configured rate. */
  currency: string
  /** Exact provider/model schedules. */
  rates: ModelRateConfig[]
}

/** Four disjoint provider-reported usage buckets. */
export interface ModelCostTokenBuckets {
  uncachedInputTokens: number
  cacheReadTokens: number
  cacheWriteTokens: number
  outputTokens: number
}

/** One model or purpose row in the session projection. */
export interface ModelCostBreakdown extends ModelCostTokenBuckets {
  /** Calls for which the provider reported usage. */
  requests: number
  /** Calls that reported usage but had no matching price schedule. */
  unpricedRequests: number
  /** Entered model operations for which no usage was reported. */
  usageUnavailableRequests: number
  /** Estimated cost in billionths of the configured currency unit. */
  costNano: number
}

/** Cost row for one exact provider/model route. */
export interface ModelCostRouteBreakdown extends ModelCostBreakdown {
  provider: string
  model: string
}

/** Cost row for one Harness model-call purpose. */
export interface ModelCostPurposeBreakdown extends ModelCostBreakdown {
  purpose: 'agent' | 'compaction'
}

/** Cost and token buckets accumulated for one agent turn. */
export interface ModelCostTurnBreakdown extends ModelCostBreakdown {
  /** Harness turn number. Compaction is session-scoped and is not included. */
  turn: number
}

/** Cost and token buckets accumulated for one UTC calendar day. */
export interface ModelCostDayBreakdown extends ModelCostBreakdown {
  /** ISO calendar date derived from the durable event timestamp. */
  day: string
}

/** Replay-derived model usage and estimated cost for one complete session log. */
export interface ModelCostProjection extends ModelCostBreakdown {
  currency: string
  byModel: ModelCostRouteBreakdown[]
  byPurpose: ModelCostPurposeBreakdown[]
  /** Durable whole-log usage grouped by agent turn for the Web turn footer. */
  byTurn: ModelCostTurnBreakdown[]
  /** Durable whole-log usage grouped by UTC day for calendar activity views. */
  byDay: ModelCostDayBreakdown[]
}

declare module '@deepseek-ai/dsh-session-projection/types' {
  interface SessionProjectionMap {
    /** Replay-derived provider/model usage priced with configured schedules. */
    modelCost: ModelCostProjection
  }
}
