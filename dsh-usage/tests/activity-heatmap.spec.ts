import { describe, expect, it } from 'vitest'
import { buildActivityWeeks } from '../src/client/activity-heatmap.js'
import type { ModelCostDayBreakdown } from '../src/types.js'

function day(day: string, tokens: number): ModelCostDayBreakdown {
  return {
    day,
    requests: 1,
    unpricedRequests: 0,
    usageUnavailableRequests: 0,
    costNano: tokens,
    uncachedInputTokens: tokens,
    cacheReadTokens: 0,
    cacheWriteTokens: 0,
    outputTokens: 0,
  }
}

describe('activity heatmap', () => {
  it('defaults to a complete 52-week activity year', () => {
    const weeks = buildActivityWeeks([], '2026-08-14')
    expect(weeks).toHaveLength(52)
    expect(weeks.flatMap(week => week.cells)).toHaveLength(364)
  })

  it('builds aligned UTC weeks, future blanks and relative intensity', () => {
    const weeks = buildActivityWeeks([
      day('2026-08-07', 25),
      day('2026-08-14', 100),
    ], '2026-08-14', 2)
    const cells = weeks.flatMap(week => week.cells)

    expect(cells).toHaveLength(14)
    expect(cells[0]?.day).toBe('2026-08-02')
    expect(cells.find(cell => cell.day === '2026-08-07')?.level).toBe(2)
    expect(cells.find(cell => cell.day === '2026-08-14')?.level).toBe(4)
    expect(cells.filter(cell => cell.future).map(cell => cell.day)).toEqual([
      '2026-08-15',
    ])
  })
})
