import type { SessionInspection } from '@deepseek-ai/dsh-session-persistence'
import type { ModelCostBreakdown, ModelCostProjection } from '../types.js'
import type { ResolvedModelCostConfig } from '../pricing.js'
import { foldModelCostEvents } from '../projection.js'
import {
  COMMUNITY_PROTOCOL_VERSION,
  COMMUNITY_TAXONOMY_VERSION,
  sealSnapshot,
} from './protocol.js'
import type { CommunityBuckets, CommunitySnapshot } from './protocol.js'

const PUBLIC_MODELS = new Set([
  'anthropic/claude-3-5-haiku',
  'anthropic/claude-3-5-sonnet',
  'anthropic/claude-3-7-sonnet',
  'anthropic/claude-haiku-4-5',
  'anthropic/claude-opus-4',
  'anthropic/claude-sonnet-4',
  'deepseek-official/deepseek-chat',
  'deepseek-official/deepseek-reasoner',
  'deepseek-official/deepseek-v4-flash',
  'deepseek-official/deepseek-v4-pro',
  'google/gemini-2.0-flash',
  'google/gemini-2.5-flash',
  'google/gemini-2.5-pro',
  'openai/gpt-4.1',
  'openai/gpt-4.1-mini',
  'openai/gpt-4o',
  'openai/gpt-4o-mini',
  'openai/gpt-5',
  'openai/gpt-5-mini',
  'openai/o3',
  'openai/o4-mini',
])

const bucketKeys = [
  'requests',
  'usageUnavailableRequests',
  'uncachedInputTokens',
  'cacheReadTokens',
  'cacheWriteTokens',
  'outputTokens',
] as const satisfies readonly (keyof CommunityBuckets)[]

function emptyBuckets(): CommunityBuckets {
  return {
    requests: 0,
    usageUnavailableRequests: 0,
    uncachedInputTokens: 0,
    cacheReadTokens: 0,
    cacheWriteTokens: 0,
    outputTokens: 0,
  }
}

function checked(value: number): number {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new Error('dsh-usage: Community snapshot exceeds the safe integer range')
  }
  return value
}

function add(target: CommunityBuckets, value: ModelCostBreakdown, direction: 1 | -1 = 1): void {
  for (const key of bucketKeys) target[key] = checked(target[key] + direction * value[key])
}

function ownedProjection(
  config: ResolvedModelCostConfig,
  inspection: SessionInspection,
): { full: ModelCostProjection; inherited: ModelCostProjection } {
  const seedLength = inspection.meta.seedLength ?? 0
  if (!Number.isSafeInteger(seedLength) || seedLength < 0 || seedLength > inspection.events.length) {
    throw new Error(`dsh-usage: invalid seedLength for session ${inspection.meta.id}`)
  }
  return {
    full: foldModelCostEvents(config, inspection.events),
    inherited: foldModelCostEvents(config, inspection.events.slice(0, seedLength)),
  }
}

export function normalizeCommunityRoute(provider: string, model: string): { provider: string; model: string } {
  return PUBLIC_MODELS.has(`${provider}/${model}`) ? { provider, model } : { provider: 'other', model: 'other' }
}

export function buildCommunitySnapshot(
  config: ResolvedModelCostConfig,
  inspections: readonly SessionInspection[],
  pluginVersion: string,
  revision: number,
): CommunitySnapshot {
  const days = new Map<string, CommunityBuckets>()
  const models = new Map<string, { provider: string; model: string; buckets: CommunityBuckets }>()

  for (const inspection of inspections) {
    const { full, inherited } = ownedProjection(config, inspection)
    for (const row of full.byDay) add(days.get(row.day) ?? (() => { const value = emptyBuckets(); days.set(row.day, value); return value })(), row)
    for (const row of inherited.byDay) add(days.get(row.day) ?? (() => { const value = emptyBuckets(); days.set(row.day, value); return value })(), row, -1)

    const applyModels = (projection: ModelCostProjection, direction: 1 | -1) => {
      for (const row of projection.byModel) {
        const route = normalizeCommunityRoute(row.provider, row.model)
        const key = `${route.provider}\u0000${route.model}`
        let target = models.get(key)
        if (target === undefined) {
          target = { ...route, buckets: emptyBuckets() }
          models.set(key, target)
        }
        add(target.buckets, row, direction)
      }
    }
    applyModels(full, 1)
    applyModels(inherited, -1)
  }

  const dailyUsage = [...days.entries()]
    .filter(([, value]) => bucketKeys.some(key => value[key] !== 0))
    .map(([day, value]) => ({ day, ...value }))
    .sort((left, right) => left.day.localeCompare(right.day))
  const modelUsage = [...models.values()]
    .filter(value => bucketKeys.some(key => value.buckets[key] !== 0))
    .map(value => ({ provider: value.provider, model: value.model, ...value.buckets }))
    .sort((left, right) => left.provider.localeCompare(right.provider) || left.model.localeCompare(right.model))

  return sealSnapshot({
    protocolVersion: COMMUNITY_PROTOCOL_VERSION,
    taxonomyVersion: COMMUNITY_TAXONOMY_VERSION,
    pluginVersion,
    revision: checked(revision),
    dailyUsage,
    modelUsage,
  })
}
