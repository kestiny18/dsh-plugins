import { describe, expect, it } from 'vitest'
import { formatCost } from '../src/format.js'

describe('cost formatter', () => {
  it('keeps tiny session costs visible', () => {
    expect(formatCost(327_600, 'USD')).toBe('$0.0003276 USD')
  })
})
