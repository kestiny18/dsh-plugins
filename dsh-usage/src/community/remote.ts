import { z } from 'zod'
import type { Context } from '@deepseek-ai/cordis'
import type { RemoteResult, TypertClientRemote, TypertRemoteContribution } from '@deepseek-ai/dsh-typert-protocol'
import type {
  CommunityEmptyRequest,
  CommunityResult,
  CommunityStatus,
  CommunitySyncRequest,
} from './types.js'

const requestSchema = z.object({}).strict()
const syncRequestSchema = z.object({ enabled: z.boolean() }).strict()
const statusSchema = z.object({
  configured: z.boolean(),
  joined: z.boolean(),
  syncEnabled: z.boolean(),
  identity: z.object({
    githubLogin: z.string(),
    displayName: z.string(),
    avatarUrl: z.url(),
    profileUrl: z.url(),
  }).strict().optional(),
  link: z.object({ verificationUri: z.url(), userCode: z.string(), expiresAt: z.number() }).strict().optional(),
  lastSyncedAt: z.number().optional(),
  lastError: z.string().optional(),
  syncInProgress: z.boolean(),
}).strict()
const resultSchema = z.object({
  ok: z.boolean(),
  value: statusSchema.optional(),
  error: z.string().optional(),
}).strict()

interface CommunityRemoteNamespace {
  status(request: CommunityEmptyRequest): Promise<RemoteResult<CommunityResult<CommunityStatus>>>
  startLink(request: CommunityEmptyRequest): Promise<RemoteResult<CommunityResult<CommunityStatus>>>
  pollLink(request: CommunityEmptyRequest): Promise<RemoteResult<CommunityResult<CommunityStatus>>>
  setSync(request: CommunitySyncRequest): Promise<RemoteResult<CommunityResult<CommunityStatus>>>
  syncNow(request: CommunityEmptyRequest): Promise<RemoteResult<CommunityResult<CommunityStatus>>>
}

export interface CommunityClientContext extends Context {
  remote: TypertClientRemote & { communityUsage: CommunityRemoteNamespace }
}

function descriptor(method: string, parameterSchema: z.ZodType): TypertRemoteContribution['descriptors'][number] {
  return {
    id: `dsh-usage#communityUsage/${method}`,
    service: 'communityUsage',
    namespace: 'communityUsage',
    method,
    invocation: { kind: 'direct' },
    parameters: [{
      name: 'request',
      wire: 'request',
      source: 'json',
      codec: { mode: 'strict', typeSymbol: `dsh-usage/community#${method}Request`, schema: parameterSchema },
    }],
    result: { mode: 'strict', typeSymbol: 'dsh-usage/community#CommunityResult', schema: resultSchema },
  }
}

export const TYPERT_REMOTE: TypertRemoteContribution = {
  package: 'dsh-usage',
  descriptors: [
    descriptor('status', requestSchema),
    descriptor('startLink', requestSchema),
    descriptor('pollLink', requestSchema),
    descriptor('setSync', syncRequestSchema),
    descriptor('syncNow', requestSchema),
  ],
}
