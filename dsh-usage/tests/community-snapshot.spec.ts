import { describe, expect, it } from 'vitest'
import type { SessionEvent } from '@deepseek-ai/dsh-session'
import type { SessionInspection } from '@deepseek-ai/dsh-session-persistence'
import { createAssistantMessage } from '@deepseek-ai/dsh-llm/message'
import { resolveConfig } from '../src/pricing.js'
import { buildCommunitySnapshot, normalizeCommunityRoute } from '../src/community/snapshot.js'
import { digestSnapshotBody } from '../src/community/protocol.js'

const config = resolveConfig({
  currency: 'USD',
  rates: [{
    provider: 'deepseek-official', model: 'deepseek-v4-flash',
    uncachedInput: 0, cacheRead: 0, cacheWrite: 0, output: 0,
  }],
})

function event<T extends SessionEvent['type']>(
  type: T,
  seq: number,
  data: Extract<SessionEvent, { type: T }>['data'],
): Extract<SessionEvent, { type: T }> {
  return { type, seq, time: 1_800_000_000_000 + seq, data } as Extract<SessionEvent, { type: T }>
}

function turn(seq: number, turnNumber: number, provider: string, model: string, input: number, output: number): SessionEvent[] {
  return [
    event('step/start', seq, { turn: turnNumber, step: 1 }),
    event('request/header', seq + 1, { header: { config: { provider, model } }, reason: 'initial' }),
    event('assistant/message', seq + 2, {
      turn: turnNumber,
      step: 1,
      message: createAssistantMessage({ content: [], source: { provider, model } }),
      usage: { inputTokens: input, cacheReadTokens: 3, outputTokens: output },
    }),
    event('step/end', seq + 3, { turn: turnNumber, step: 1 }),
  ]
}

function inspection(id: string, events: SessionEvent[], seedLength?: number): SessionInspection {
  return {
    meta: {
      version: 1,
      id,
      createdAt: 1_800_000_000_000,
      ...(seedLength === undefined ? {} : { seedLength, parentSession: 'parent' }),
    } as never,
    events,
  }
}

describe('Community Host snapshot', () => {
  it('subtracts a fork seed while keeping the child model call and cache buckets', () => {
    const inherited = turn(0, 1, 'deepseek-official', 'deepseek-v4-flash', 10, 2)
    const childWork = turn(4, 2, 'private-company', 'route.internal', 20, 4)
    const snapshot = buildCommunitySnapshot(config, [
      inspection('parent', inherited),
      inspection('child', [...inherited, ...childWork], inherited.length),
    ], '0.2.0', 1)

    expect(snapshot.dailyUsage).toEqual([expect.objectContaining({
      requests: 2,
      uncachedInputTokens: 30,
      cacheReadTokens: 6,
      outputTokens: 6,
    })])
    expect(snapshot.modelUsage).toEqual([
      expect.objectContaining({ provider: 'deepseek-official', model: 'deepseek-v4-flash', requests: 1 }),
      expect.objectContaining({ provider: 'other', model: 'other', requests: 1 }),
    ])
  })

  it('never sends unknown provider or model identifiers', () => {
    expect(normalizeCommunityRoute('corp-gateway', 'secret-model')).toEqual({ provider: 'other', model: 'other' })
    expect(normalizeCommunityRoute('deepseek-official', 'deepseek-v4-flash')).toEqual({
      provider: 'deepseek-official', model: 'deepseek-v4-flash',
    })
  })

  it('creates a stable digest independent of object key insertion order', () => {
    const body = {
      protocolVersion: 1 as const,
      taxonomyVersion: 1 as const,
      pluginVersion: '0.2.0',
      revision: 1,
      dailyUsage: [],
      modelUsage: [],
    }
    const first = digestSnapshotBody(body)
    expect(digestSnapshotBody({ ...body, revision: 1 })).toBe(first)
    expect(first).toMatch(/^[a-f0-9]{64}$/u)
  })
})
