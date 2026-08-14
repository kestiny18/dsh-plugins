import { useMemo, useRef, useState } from 'react'
import type { KeyboardEvent } from 'react'
import type { ModelCostDayBreakdown } from '../types.js'
import { formatCost } from '../format.js'
import { buildActivityWeeks } from './activity-heatmap.js'
import { formatTokenCount } from './turn-usage.js'
import { hasCompleteCost, inputTokens, totalTokens } from './usage-view.js'
import css from './ActivityHeatmap.module.css'

export interface ActivityHeatmapProps {
  rows: readonly ModelCostDayBreakdown[]
  currency: string | undefined
  /** Injectable UTC date keeps the calendar deterministic in tests. */
  endDay?: string
}

function todayUtc(): string {
  return new Date().toISOString().slice(0, 10)
}

function dayLabel(day: string): string {
  return new Date(`${day}T00:00:00.000Z`).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC',
  })
}

function accessibleDetail(row: ModelCostDayBreakdown | undefined, day: string, currency: string | undefined): string {
  if (row === undefined) return `${dayLabel(day)}: no model usage`
  const cost = currency !== undefined && hasCompleteCost(row) ? formatCost(row.costNano, currency) : '--'
  return `${dayLabel(day)}: ${totalTokens(row).toLocaleString()} total tokens; `
    + `${inputTokens(row).toLocaleString()} input; ${row.cacheReadTokens.toLocaleString()} cache; `
    + `${row.outputTokens.toLocaleString()} output; cost ${cost}`
}

/** Full-year keyboard-accessible token activity calendar. */
export function ActivityHeatmap({ rows, currency, endDay = todayUtc() }: ActivityHeatmapProps) {
  const weeks = useMemo(() => buildActivityWeeks(rows, endDay), [endDay, rows])
  const available = weeks.flatMap(week => week.cells).filter(cell => !cell.future)
  const latestActive = [...available].reverse().find(cell => cell.usage !== undefined)
  const [selectedDay, setSelectedDay] = useState<string | undefined>()
  const calendar = useRef<HTMLDivElement | null>(null)
  const selected = available.find(cell => cell.day === selectedDay) ?? latestActive ?? available.at(-1)
  const selectedUsage = selected?.usage
  const selectedCost = selectedUsage !== undefined && currency !== undefined && hasCompleteCost(selectedUsage)
    ? formatCost(selectedUsage.costNano, currency)
    : '--'

  const moveFocus = (event: KeyboardEvent<HTMLButtonElement>, day: string): void => {
    const delta = event.key === 'ArrowLeft' ? -7
      : event.key === 'ArrowRight' ? 7
        : event.key === 'ArrowUp' ? -1
          : event.key === 'ArrowDown' ? 1
            : 0
    if (delta === 0) return
    const index = available.findIndex(cell => cell.day === day)
    const target = available[index + delta]
    if (target === undefined) return
    event.preventDefault()
    setSelectedDay(target.day)
    calendar.current?.querySelector<HTMLButtonElement>(`button[data-day="${target.day}"]`)?.focus()
  }

  return (
    <section className={css.activity} aria-labelledby="dsh-usage-activity">
      <div className={css.activityHead}>
        <div>
          <h3 className={css.title} id="dsh-usage-activity">Activity</h3>
          <p className={css.caption}>Last 52 weeks · UTC</p>
        </div>
        <div className={css.legend} aria-label="Token intensity: less to more">
          <span>Less</span>
          {[0, 1, 2, 3, 4].map(level => <i key={level} data-level={level} />)}
          <span>More</span>
        </div>
      </div>

      <div className={css.selected} aria-live="polite">
        <strong>{selected === undefined ? 'No activity' : dayLabel(selected.day)}</strong>
        {selectedUsage === undefined
          ? <span>No model usage</span>
          : (
            <span>
              {formatTokenCount(totalTokens(selectedUsage))} tokens
              {' · '}Input {formatTokenCount(inputTokens(selectedUsage))}
              {' · '}Cache {formatTokenCount(selectedUsage.cacheReadTokens)}
              {' · '}Output {formatTokenCount(selectedUsage.outputTokens)}
              {' · '}Cost {selectedCost}
            </span>
          )}
      </div>

      <div className={css.calendar}>
        <div className={css.weekdays} aria-hidden>
          <span /><span>Mon</span><span /><span>Wed</span><span /><span>Fri</span><span />
        </div>
        <div className={css.weeks} ref={calendar}>
          {weeks.map((week, index) => (
            <div className={css.week} key={week.cells[0]?.day ?? index}>
              <span className={css.month} aria-hidden>{week.label ?? ''}</span>
              {week.cells.map(cell => cell.future
                ? <span className={css.future} key={cell.day} aria-hidden />
                : (
                  <button
                    type="button"
                    className={css.cell}
                    data-level={cell.level}
                    data-day={cell.day}
                    key={cell.day}
                    aria-label={accessibleDetail(cell.usage, cell.day, currency)}
                    aria-pressed={selected?.day === cell.day}
                    tabIndex={selected?.day === cell.day ? 0 : -1}
                    title={accessibleDetail(cell.usage, cell.day, currency)}
                    onClick={() => { setSelectedDay(cell.day) }}
                    onMouseEnter={() => { setSelectedDay(cell.day) }}
                    onFocus={() => { setSelectedDay(cell.day) }}
                    onKeyDown={(event) => { moveFocus(event, cell.day) }}
                  />
                ))}
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
