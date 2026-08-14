import { describe, expect, it } from 'vitest'
import type { ConversationSnapshot } from '@deepseek-ai/dsh-client-runtime/client'
import { formatTokenCount, usageForMessage } from '../src/client/turn-usage.js'
import type { ModelCostProjection } from '../src/types.js'

const breakdown = {
  requests: 2,
  unpricedRequests: 0,
  usageUnavailableRequests: 0,
  costNano: 0,
  uncachedInputTokens: 108_000,
  cacheReadTokens: 5_400_000,
  cacheWriteTokens: 600,
  outputTokens: 30_400,
}

describe('turn usage footer', () => {
  it('maps the closing message to durable whole-turn usage', () => {
    const nodes = [
      { kind: 'assistant', messageId: 'earlier', turn: 4 },
      { kind: 'assistant', messageId: 'closing', turn: 4 },
    ] as unknown as ConversationSnapshot['nodes']
    const projection = {
      currency: 'USD',
      ...breakdown,
      byModel: [],
      byPurpose: [],
      byTurn: [{ turn: 4, ...breakdown }],
      byDay: [],
    } satisfies ModelCostProjection

    expect(usageForMessage(nodes, projection, 'closing')).toEqual({
      turn: 4,
      totalTokens: 5_539_000,
      inputTokens: 108_600,
      cacheTokens: 5_400_000,
      outputTokens: 30_400,
      costNano: 0,
      currency: 'USD',
    })
  })

  it('omits cost when any turn request is unpriced', () => {
    const nodes = [
      { kind: 'assistant', messageId: 'closing', turn: 4 },
    ] as unknown as ConversationSnapshot['nodes']
    const projection = {
      currency: 'USD',
      ...breakdown,
      unpricedRequests: 1,
      byModel: [],
      byPurpose: [],
      byTurn: [{ turn: 4, ...breakdown, unpricedRequests: 1 }],
      byDay: [],
    } satisfies ModelCostProjection

    expect(usageForMessage(nodes, projection, 'closing')).not.toHaveProperty('costNano')
  })

  it('uses compact stable labels', () => {
    expect(formatTokenCount(999)).toBe('999')
    expect(formatTokenCount(12_250)).toBe('12.3K')
    expect(formatTokenCount(5_400_000)).toBe('5.4M')
  })
})
