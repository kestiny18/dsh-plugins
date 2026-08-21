import { z } from 'zod'

export const safeInteger = z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER)
export const bucketsSchema = z.object({
  requests: safeInteger,
  usageUnavailableRequests: safeInteger,
  uncachedInputTokens: safeInteger,
  cacheReadTokens: safeInteger,
  cacheWriteTokens: safeInteger,
  outputTokens: safeInteger,
}).strict()
export const dayUsageSchema = bucketsSchema.extend({ day: z.string().regex(/^\d{4}-\d{2}-\d{2}$/u) }).strict()
export const modelUsageSchema = bucketsSchema.extend({
  provider: z.string().min(1).max(64),
  model: z.string().min(1).max(128),
}).strict()
export const snapshotSchema = z.object({
  protocolVersion: z.literal(1),
  taxonomyVersion: z.literal(1),
  pluginVersion: z.string().regex(/^\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?$/u).max(64),
  revision: safeInteger.positive(),
  dailyUsage: z.array(dayUsageSchema).max(400),
  modelUsage: z.array(modelUsageSchema).max(100),
  snapshotDigest: z.string().regex(/^[a-f0-9]{64}$/u),
}).strict()

export type Snapshot = z.infer<typeof snapshotSchema>

export interface PublicIdentity {
  githubLogin: string
  displayName: string
  avatarUrl: string
  profileUrl: string
}

export interface LeaderboardRow extends PublicIdentity {
  rank: number
  requests: number
  uncachedInputTokens: number
  cacheReadTokens: number
  cacheWriteTokens: number
  outputTokens: number
  totalTokens: number
  isViewer: boolean
}

export type Period = 'today' | '7d' | '30d' | 'all'
