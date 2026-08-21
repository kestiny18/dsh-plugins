import { useEffect, useMemo, useState } from 'react'
import type { PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import type {} from '@deepseek-ai/dsh-client-ui-settings/client'
import type {} from '../types.js'
import { formatCost } from '../format.js'
import type { ModelCostBreakdown } from '../types.js'
import { formatTokenCount } from './turn-usage.js'
import {
  aggregateUsage, hasCompleteCost, inputTokens, modelCalls, totalTokens,
} from './usage-view.js'
import type { SessionUsageRow } from './usage-view.js'
import { ActivityHeatmap } from './ActivityHeatmap.js'
import css from './UsageSection.module.css'
import { CommunitySettings } from './CommunitySettings.js'
import type { CommunityClientContext } from '../community/remote.js'

export type UsageSectionProps = PropsRuntime<'settings.section'>
export type CommunityUsageSectionProps = UsageSectionProps & { communityContext?: CommunityClientContext }

function exactTokens(value: number): string {
  return new Intl.NumberFormat('en-US').format(value)
}

function tokenValue(value: number): string {
  return value === 0 ? '0' : formatTokenCount(value)
}

function costValue(value: ModelCostBreakdown & { currency: string | undefined }): string {
  if (value.currency === undefined || !hasCompleteCost(value)) return '--'
  return formatCost(value.costNano, value.currency)
}

function DetailRow({
  title, subtitle, tokens, cost,
}: {
  title: string
  subtitle: string
  tokens: number
  cost: string
}) {
  return (
    <li className={css.detailRow}>
      <span className={css.detailIdentity}>
        <span className={css.detailTitle}>{title}</span>
        <span className={css.detailSubtitle}>{subtitle}</span>
      </span>
      <span className={css.detailNumber} title={`${exactTokens(tokens)} tokens`}>
        {tokenValue(tokens)}
        <span className={css.unit}> tokens</span>
      </span>
      <span className={css.detailCost}>{cost}</span>
    </li>
  )
}

/** Settings page for all-session and per-session model usage. */
export function UsageSection({ useSessions, communityContext }: CommunityUsageSectionProps) {
  const sessions = useSessions(state => state)
  const [scope, setScope] = useState('all')
  const sessionRows = useMemo<SessionUsageRow[]>(() => sessions.ids.flatMap((id) => {
    const summary = sessions.byId[id]
    const usage = summary?.projectionValues?.modelCost
    if (summary === undefined || usage === undefined) return []
    // Every session gets an empty projection baseline. Keep the Usage roster
    // focused on sessions that have actually attempted a model operation.
    if (modelCalls(usage) === 0 && totalTokens(usage) === 0) return []
    return [{ id, title: summary.displayTitle, usage }]
  }), [sessions])

  useEffect(() => {
    if (scope !== 'all' && !sessionRows.some(row => row.id === scope)) setScope('all')
  }, [scope, sessionRows])

  const selectedRows = scope === 'all'
    ? sessionRows
    : sessionRows.filter(row => row.id === scope)
  const aggregate = useMemo(() => aggregateUsage(selectedRows), [selectedRows])
  const selected = scope === 'all' ? undefined : selectedRows[0]
  const calls = modelCalls(aggregate)
  const cost = costValue(aggregate)

  return (
    <div className={css.section} data-dsh-usage-settings="">
      <div className={css.headingRow}>
        <div>
          <h2 className={css.title}>Usage</h2>
          <p className={css.intro}>Model tokens and estimated cost derived from session history.</p>
        </div>
        <label className={css.scopeField}>
          <span className={css.scopeLabel}>Scope</span>
          <select
            className={css.select}
            value={scope}
            onChange={(event) => { setScope(event.target.value) }}
          >
            <option value="all">All sessions</option>
            {sessionRows.map(row => <option key={row.id} value={row.id}>{row.title}</option>)}
          </select>
        </label>
      </div>

      {selectedRows.length === 0
        ? <p className={css.empty}>Usage will appear after a model call reports token data.</p>
        : (
          <>
            <div className={css.usageCard}>
              <div className={css.summary} aria-label="Usage summary">
                {([
                  ['Total tokens', totalTokens(aggregate)],
                  ['Input', inputTokens(aggregate)],
                  ['Cache', aggregate.cacheReadTokens],
                  ['Output', aggregate.outputTokens],
                ] as const).map(([label, value]) => (
                  <div className={css.stat} key={label} title={`${exactTokens(value)} ${label.toLowerCase()}`}>
                    <span className={css.statLabel}>{label}</span>
                    <strong className={css.statValue}>{tokenValue(value)}</strong>
                  </div>
                ))}
                <div className={css.stat} title={`${exactTokens(calls)} model calls`}>
                  <span className={css.statLabel}>Calls</span>
                  <strong className={css.statValue}>{exactTokens(calls)}</strong>
                </div>
                <div className={css.stat} title={cost === '--' ? 'Cost unavailable: missing usage or pricing' : cost}>
                  <span className={css.statLabel}>Estimated cost</span>
                  <strong className={`${css.statValue} ${css.costValue}`}>{cost}</strong>
                </div>
              </div>

              {cost === '--' && calls > 0
                ? <p className={css.note}>Cost requires complete provider usage and a matching price for every call.</p>
                : null}

              <ActivityHeatmap rows={aggregate.byDay} currency={aggregate.currency} />
            </div>

            <section className={css.group} aria-labelledby="dsh-usage-models">
              <h3 className={css.groupTitle} id="dsh-usage-models">By model</h3>
              <div className={css.columnHead} aria-hidden>
                <span>Model</span><span>Tokens</span><span>Cost</span>
              </div>
              <ul className={css.details}>
                {aggregate.byModel.map(model => (
                  <DetailRow
                    key={`${model.provider}/${model.model}`}
                    title={model.model}
                    subtitle={`${model.provider} · ${exactTokens(modelCalls(model))} calls`}
                    tokens={totalTokens(model)}
                    cost={costValue({ ...model, currency: aggregate.currency })}
                  />
                ))}
              </ul>
            </section>

            <section className={css.group} aria-labelledby="dsh-usage-detail">
              <h3 className={css.groupTitle} id="dsh-usage-detail">
                {selected === undefined ? 'By session' : 'By turn'}
              </h3>
              <div className={css.columnHead} aria-hidden>
                <span>{selected === undefined ? 'Session' : 'Turn'}</span><span>Tokens</span><span>Cost</span>
              </div>
              <ul className={css.details}>
                {selected === undefined
                  ? sessionRows.map(row => (
                    <DetailRow
                      key={row.id}
                      title={row.title}
                      subtitle={`${exactTokens(modelCalls(row.usage))} calls · ${row.id}`}
                      tokens={totalTokens(row.usage)}
                      cost={costValue(row.usage)}
                    />
                  ))
                  : [...selected.usage.byTurn].reverse().map(turn => (
                    <DetailRow
                      key={turn.turn}
                      title={`Turn ${turn.turn}`}
                      subtitle={`Input ${tokenValue(inputTokens(turn))} · Cache ${tokenValue(turn.cacheReadTokens)} · Output ${tokenValue(turn.outputTokens)}`}
                      tokens={totalTokens(turn)}
                      cost={costValue({ ...turn, currency: selected.usage.currency })}
                    />
                  ))}
              </ul>
            </section>
          </>
        )}
      {communityContext === undefined
        ? <p className={css.note}>Community controls are unavailable in this Harness build. Local Usage is unaffected.</p>
        : <CommunitySettings ctx={communityContext} />}
    </div>
  )
}
