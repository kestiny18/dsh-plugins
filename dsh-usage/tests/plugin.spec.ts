import { describe, expect, it, vi } from 'vitest'
import type { Context } from '@deepseek-ai/cordis'
import { remoteMethods } from '@deepseek-ai/dsh-typert-protocol'
import { apply, inject } from '../src/index.js'
import { CommunityUsageService } from '../src/community/service.js'
import { TYPERT_REMOTE } from '../src/community/remote.js'
import { TYPERT } from '../src/community/typert.js'

describe('plugin registration', () => {
  it('registers the local projection and mounts the isolated Community service', () => {
    const register = vi.fn()
    const plugin = vi.fn()
    const ctx = { sessionProjections: { register }, plugin } as unknown as Context
    apply(ctx, {
      currency: 'USD',
      rates: [{
        provider: 'p', model: 'm', uncachedInput: 1, cacheRead: 1, cacheWrite: 1, output: 1,
      }],
    })

    expect(inject).toEqual(['sessionProjections'])
    expect(register).toHaveBeenCalledOnce()
    expect(plugin).toHaveBeenCalledOnce()
  })

  it('publishes the complete Community RPC surface without decorator syntax', () => {
    const service = Object.create(CommunityUsageService.prototype) as object
    expect(remoteMethods(service).map(marker => marker.exportName ?? marker.method)).toEqual([
      'status', 'startLink', 'pollLink', 'setSync', 'syncNow',
    ])
    expect(TYPERT.package).toBe('dsh-usage')
    expect(TYPERT.face).toBe('host')
    expect(TYPERT.invocations).toBe(TYPERT_REMOTE.descriptors)
    expect(TYPERT.invocations.map(descriptor => `${descriptor.namespace}/${descriptor.method}`)).toEqual([
      'communityUsage/status',
      'communityUsage/startLink',
      'communityUsage/pollLink',
      'communityUsage/setSync',
      'communityUsage/syncNow',
    ])
  })
})
