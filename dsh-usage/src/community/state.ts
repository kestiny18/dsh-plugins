import { z } from 'zod'
import { defineDomain } from '@deepseek-ai/dsh-storage-domain'
import { communityDaySchema, communityModelSchema } from './protocol.js'

const identitySchema = z.object({
  githubLogin: z.string().min(1),
  displayName: z.string().min(1),
  avatarUrl: z.url(),
  profileUrl: z.url(),
}).strict()

const snapshotSchema = z.object({
  protocolVersion: z.literal(1),
  taxonomyVersion: z.literal(1),
  pluginVersion: z.string().min(1),
  revision: z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER),
  dailyUsage: z.array(communityDaySchema),
  modelUsage: z.array(communityModelSchema),
  snapshotDigest: z.string().regex(/^[a-f0-9]{64}$/u),
}).strict()

export const communityStateSchema = z.object({
  installationId: z.uuid(),
  syncEnabled: z.boolean(),
  acceptedRevision: z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER),
  deviceCredential: z.string().min(32).optional(),
  identity: identitySchema.optional(),
  pendingLink: z.object({
    deviceCode: z.string().min(32),
    verificationUri: z.url(),
    userCode: z.string().min(4),
    expiresAt: z.number().int().nonnegative(),
  }).strict().optional(),
  pendingSnapshot: snapshotSchema.optional(),
  lastDigest: z.string().regex(/^[a-f0-9]{64}$/u).optional(),
  lastSyncedAt: z.number().int().nonnegative().optional(),
  lastError: z.string().max(500).optional(),
}).strict()

export type CommunityState = z.infer<typeof communityStateSchema>

export const communityStateDomainSpec = defineDomain({
  name: 'dsh_usage_community',
  version: 1,
  global: {
    schema: communityStateSchema,
    initial: {
      installationId: '00000000-0000-4000-8000-000000000000',
      syncEnabled: false,
      acceptedRevision: 0,
    },
  },
  tables: {},
})
