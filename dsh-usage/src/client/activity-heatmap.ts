import type { ModelCostDayBreakdown } from '../types.js'
import { totalTokens } from './usage-view.js'

const DAY_MS = 86_400_000

export interface ActivityCell {
  day: string
  level: 0 | 1 | 2 | 3 | 4
  future: boolean
  usage: ModelCostDayBreakdown | undefined
}

export interface ActivityWeek {
  label: string | undefined
  cells: ActivityCell[]
}

function dayString(value: Date): string {
  return value.toISOString().slice(0, 10)
}

function dateOf(day: string): Date {
  return new Date(`${day}T00:00:00.000Z`)
}

function intensity(tokens: number, maximum: number): 0 | 1 | 2 | 3 | 4 {
  if (tokens === 0 || maximum === 0) return 0
  return Math.min(4, Math.max(1, Math.ceil(Math.sqrt(tokens / maximum) * 4))) as 1 | 2 | 3 | 4
}

/** Build Sunday-to-Saturday columns ending in the UTC week containing endDay. */
export function buildActivityWeeks(
  rows: readonly ModelCostDayBreakdown[],
  endDay: string,
  weekCount = 52,
): ActivityWeek[] {
  const end = dateOf(endDay)
  if (!Number.isFinite(end.getTime())) throw new Error(`invalid activity end day: ${endDay}`)
  const start = new Date(end.getTime() - (end.getUTCDay() + (weekCount - 1) * 7) * DAY_MS)
  const byDay = new Map(rows.map(row => [row.day, row]))
  let maximum = 0
  for (const row of rows) {
    if (row.day < dayString(start) || row.day > endDay) continue
    maximum = Math.max(maximum, totalTokens(row))
  }

  return Array.from({ length: weekCount }, (_, weekIndex) => {
    const cells = Array.from({ length: 7 }, (_unused, dayIndex): ActivityCell => {
      const date = new Date(start.getTime() + (weekIndex * 7 + dayIndex) * DAY_MS)
      const day = dayString(date)
      const future = day > endDay
      const usage = future ? undefined : byDay.get(day)
      return {
        day,
        future,
        usage,
        level: future ? 0 : intensity(usage === undefined ? 0 : totalTokens(usage), maximum),
      }
    })
    const firstOfMonth = cells.find(cell => dateOf(cell.day).getUTCDate() === 1)
    const labelDate = firstOfMonth === undefined && weekIndex === 0 ? dateOf(cells[0]!.day) : firstOfMonth === undefined ? undefined : dateOf(firstOfMonth.day)
    return {
      label: labelDate?.toLocaleDateString('en-US', { month: 'short', timeZone: 'UTC' }),
      cells,
    }
  })
}
