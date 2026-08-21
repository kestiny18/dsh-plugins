import { createHash } from 'node:crypto'
import { z } from 'zod'

export const COMMUNITY_PROTOCOL_VERSION = 1 as const
export const COMMUNITY_TAXONOMY_VERSION = 1 as const

const safeInteger = z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER)

export const communityBucketsSchema = z.object({
  requests: safeInteger,
  usageUnavailableRequests: safeInteger,
  uncachedInputTokens: safeInteger,
  cacheReadTokens: safeInteger,
  cacheWriteTokens: safeInteger,
  outputTokens: safeInteger,
}).strict()

export type CommunityBuckets = z.infer<typeof communityBucketsSchema>

export const communityDaySchema = communityBucketsSchema.extend({
  day: z.string().regex(/^\d{4}-\d{2}-\d{2}$/u),
}).strict()

export const communityModelSchema = communityBucketsSchema.extend({
  provider: z.string().min(1).max(64),
  model: z.string().min(1).max(128),
}).strict()

export interface CommunitySnapshotBody {
  protocolVersion: typeof COMMUNITY_PROTOCOL_VERSION
  taxonomyVersion: typeof COMMUNITY_TAXONOMY_VERSION
  pluginVersion: string
  revision: number
  dailyUsage: z.infer<typeof communityDaySchema>[]
  modelUsage: z.infer<typeof communityModelSchema>[]
}

export interface CommunitySnapshot extends CommunitySnapshotBody {
  snapshotDigest: string
}

function canonicalValue(value: unknown): string {
  if (value === null || typeof value === 'boolean' || typeof value === 'number' || typeof value === 'string') {
    return JSON.stringify(value)
  }
  if (Array.isArray(value)) return `[${value.map(canonicalValue).join(',')}]`
  if (typeof value === 'object') {
    const object = value as Record<string, unknown>
    return `{${Object.keys(object).sort().map(key => `${JSON.stringify(key)}:${canonicalValue(object[key])}`).join(',')}}`
  }
  throw new TypeError('dsh-usage: snapshot contains a non-JSON value')
}

export function canonicalSnapshotBody(body: CommunitySnapshotBody): string {
  return canonicalValue(body)
}

export function digestSnapshotBody(body: CommunitySnapshotBody): string {
  return createHash('sha256').update(canonicalSnapshotBody(body)).digest('hex')
}

export function sealSnapshot(body: CommunitySnapshotBody): CommunitySnapshot {
  return { ...body, snapshotDigest: digestSnapshotBody(body) }
}
