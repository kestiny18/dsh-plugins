import { describe, expect, it, vi } from 'vitest'
import type { Context } from '@deepseek-ai/cordis'
import { apply, inject } from '../src/index.js'

describe('plugin registration', () => {
  it('registers only the session projection and has no command dependency', () => {
    const register = vi.fn()
    const ctx = { sessionProjections: { register } } as unknown as Context
    apply(ctx, {
      currency: 'USD',
      rates: [{
        provider: 'p', model: 'm', uncachedInput: 1, cacheRead: 1, cacheWrite: 1, output: 1,
      }],
    })

    expect(inject).toEqual(['sessionProjections'])
    expect(register).toHaveBeenCalledOnce()
  })
})
