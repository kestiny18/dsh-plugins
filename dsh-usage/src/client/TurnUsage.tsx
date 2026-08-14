import { useMemo } from 'react'
import type { PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import type {} from '@deepseek-ai/dsh-client-ui-conversation/client'
import type {} from '../types.js'
import { formatCost } from '../format.js'
import { formatTokenCount, usageForMessage } from './turn-usage.js'
import css from './TurnUsage.module.css'

export type TurnUsageProps = PropsRuntime<'conversation.chat.assistant-actions'>

/** Always-visible, whole-turn model token usage inside the assistant action row. */
export function TurnUsage({ messageId, useSession, useProjection }: TurnUsageProps) {
  const nodes = useSession(snapshot => snapshot.nodes)
  const projection = useProjection('modelCost')
  const usage = useMemo(
    () => usageForMessage(nodes, projection, messageId),
    [messageId, nodes, projection],
  )
  if (usage === undefined) return null

  const total = formatTokenCount(usage.totalTokens)
  const input = formatTokenCount(usage.inputTokens)
  const cache = formatTokenCount(usage.cacheTokens)
  const output = formatTokenCount(usage.outputTokens)
  const cost = usage.costNano === undefined || usage.currency === undefined
    ? undefined
    : formatCost(usage.costNano, usage.currency)
  const detail = `Token usage for this turn: ${usage.totalTokens.toLocaleString()} total; `
    + `${usage.inputTokens.toLocaleString()} input; ${usage.cacheTokens.toLocaleString()} cache; `
    + `${usage.outputTokens.toLocaleString()} output`
    + (cost === undefined ? '' : `; estimated cost ${cost}`)

  return (
    <span
      className={css.root}
      data-dsh-usage-turn=""
      data-turn={usage.turn}
      aria-label={detail}
      title={detail}
    >
      <span className={css.metric}>Total {total} tokens</span>
      <span className={css.separator} aria-hidden>·</span>
      <span className={css.metric}>Input {input}</span>
      <span className={css.separator} aria-hidden>·</span>
      <span className={css.metric}>Cache {cache}</span>
      <span className={`${css.metric} ${css.output}`}>
        <span className={css.separator} aria-hidden>·</span>
        &nbsp;Output {output}
      </span>
      {cost === undefined ? null : (
        <span className={`${css.metric} ${css.cost}`}>
          <span className={css.separator} aria-hidden>·</span>
          &nbsp;Cost {cost}
        </span>
      )}
    </span>
  )
}
