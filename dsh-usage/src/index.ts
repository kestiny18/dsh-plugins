/** Replay-aware model usage and cost projection for DeepSeek Harness. */

import type { Context } from '@deepseek-ai/cordis'
import z from '@deepseek-ai/schemastery'
import type {} from '@deepseek-ai/dsh-session-projection'
import { resolveConfig } from './pricing.js'
import { createModelCostProjection } from './projection.js'
import type { ModelCostConfig, ModelRateConfig } from './types.js'

export type * from './types.js'
export { createModelCostProjection } from './projection.js'
export { formatCost } from './format.js'
export { resolveConfig } from './pricing.js'

export const name = 'usage'
export const inject = ['sessionProjections']

const rateSchema: z<ModelRateConfig> = z.object({
  provider: z.string().required(),
  model: z.string().required(),
  effectiveFrom: z.string(),
  uncachedInput: z.number().min(0).required(),
  cacheRead: z.number().min(0).required(),
  cacheWrite: z.number().min(0).required(),
  output: z.number().min(0).required(),
})

/** Loader schema for currency and effective-dated exact-model schedules. */
export const Config: z<ModelCostConfig> = z.object({
  currency: z.string().default('USD'),
  rates: z.array(rateSchema).required(),
})

/** Register the replay-derived usage and cost projection. */
export function apply(ctx: Context, config: ModelCostConfig): void {
  const resolved = resolveConfig(config)
  ctx.sessionProjections.register(createModelCostProjection(resolved))
}
