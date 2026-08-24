import { describe, expect, it, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import type { Context } from '@deepseek-ai/cordis'
import { remoteMethods } from '@deepseek-ai/dsh-typert-protocol'
import { apply, inject } from '../src/index.js'
import { CommunityUsageService } from '../src/community/service.js'
import { TYPERT_REMOTE } from '../src/community/remote.js'
import { TYPERT } from '../src/community/typert.js'

const packageVersion = (JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8')) as { version: string }).version

describe('plugin registration', () => {
  it('registers the local projection and mounts the isolated Community service', () => {
    const register = vi.fn()
    const plugin = vi.fn()
    const ctx = { sessionProjections: { register }, plugin } as unknown as Context
    apply(ctx, {
      currency: 'USD',
      communityUrl: 'https://dshcommunity.com',
      rates: [{
        provider: 'p', model: 'm', uncachedInput: 1, cacheRead: 1, cacheWrite: 1, output: 1,
      }],
    })

    expect(inject).toEqual(['sessionProjections'])
    expect(register).toHaveBeenCalledOnce()
    expect(plugin).toHaveBeenCalledWith(CommunityUsageService, expect.objectContaining({
      baseUrl: 'https://dshcommunity.com',
      pluginVersion: packageVersion,
    }))
  })

  it('rewrites a persisted legacy profile link to the configured Community origin', async () => {
    const service = Object.create(CommunityUsageService.prototype) as CommunityUsageService
    Object.assign(service, {
      config: { baseUrl: 'https://dshcommunity.com', pluginVersion: packageVersion, projection: {} },
      state: {
        get: () => ({
          installationId: '00000000-0000-4000-8000-000000000000',
          syncEnabled: true,
          acceptedRevision: 1,
          deviceCredential: 'x'.repeat(32),
          identity: {
            githubLogin: 'kestiny18',
            displayName: 'kestiny',
            avatarUrl: 'https://avatars.githubusercontent.com/u/1',
            profileUrl: 'https://dsh-community.example.workers.dev/u/kestiny18',
          },
        }),
      },
    })

    const result = await service.status({})
    expect(result.value?.identity?.profileUrl).toBe('https://dshcommunity.com/u/kestiny18')
  })

  it('publishes the complete Community RPC surface without decorator syntax', () => {
    const service = Object.create(CommunityUsageService.prototype) as object
    expect(remoteMethods(service).map(marker => marker.exportName ?? marker.method)).toEqual([
      'status', 'startLink', 'pollLink', 'setSync', 'syncNow', 'signOut',
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
      'communityUsage/signOut',
    ])
  })
})
