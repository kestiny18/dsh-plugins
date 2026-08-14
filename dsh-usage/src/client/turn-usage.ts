import type { ConversationSnapshot } from '@deepseek-ai/dsh-client-runtime/client'
import type { ModelCostProjection, ModelCostTurnBreakdown } from '../types.js'
import { hasCompleteCost, inputTokens, totalTokens } from './usage-view.js'

/** Display-ready, disjoint per-turn token buckets. */
export interface TurnUsageDisplay {
  turn: number
  totalTokens: number
  /** Uncached input plus cache-write input. */
  inputTokens: number
  /** Provider-reported cache-read input. */
  cacheTokens: number
  outputTokens: number
  /** Present only when every model call in the turn has complete usage and pricing. */
  costNano?: number
  currency?: string
}

/** Compact a token count without hiding the exact value from the accessible label. */
export function formatTokenCount(value: number): string {
  const scaled = (divisor: number, suffix: string): string => {
    const number = value / divisor
    const digits = number >= 100 ? 0 : 1
    return `${number.toFixed(digits).replace(/\.0$/u, '')}${suffix}`
  }
  if (value < 1_000) return String(value)
  if (value < 1_000_000) return scaled(1_000, 'K')
  if (value < 1_000_000_000) return scaled(1_000_000, 'M')
  return scaled(1_000_000_000, 'B')
}

/** Resolve the turn addressed by one finalized assistant message. */
export function turnForMessage(
  nodes: ConversationSnapshot['nodes'],
  messageId: string,
): number | undefined {
  for (const node of nodes) {
    if (node.kind === 'assistant' && node.messageId === messageId) return node.turn
  }
  return undefined
}

/** Convert the durable whole-log turn projection into the four footer readings. */
export function displayUsage(
  usage: ModelCostTurnBreakdown,
  currency: string,
): TurnUsageDisplay {
  return {
    turn: usage.turn,
    totalTokens: totalTokens(usage),
    inputTokens: inputTokens(usage),
    cacheTokens: usage.cacheReadTokens,
    outputTokens: usage.outputTokens,
    ...hasCompleteCost(usage) ? { costNano: usage.costNano, currency } : {},
  }
}

/** Find one message's durable per-turn usage; undefined means no provider usage was recorded. */
export function usageForMessage(
  nodes: ConversationSnapshot['nodes'],
  projection: ModelCostProjection | undefined,
  messageId: string,
): TurnUsageDisplay | undefined {
  if (projection === undefined) return undefined
  const turn = turnForMessage(nodes, messageId)
  if (turn === undefined) return undefined
  const usage = projection.byTurn.find(candidate => candidate.turn === turn)
  if (usage === undefined || usage.requests === 0) return undefined
  return displayUsage(usage, projection.currency)
}
