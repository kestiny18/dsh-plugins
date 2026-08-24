import { describe, expect, it } from 'vitest'
import type { CommunityState } from '../src/community/state.js'
import { signedOutCommunityState } from '../src/community/state.js'

describe('Community sign out state', () => {
  it('disables sync and clears device identity without erasing local sync history', () => {
    const state: CommunityState = {
      installationId: '00000000-0000-4000-8000-000000000001',
      syncEnabled: true,
      acceptedRevision: 7,
      deviceCredential: 'x'.repeat(48),
      identity: {
        githubLogin: 'builder',
        displayName: 'Builder',
        avatarUrl: 'https://avatars.githubusercontent.com/u/1',
        profileUrl: 'https://dshcommunity.com/u/builder',
      },
      pendingLink: {
        deviceCode: 'y'.repeat(48),
        verificationUri: 'https://dshcommunity.com/auth/github/start',
        userCode: 'ABCD-EFGH',
        expiresAt: 1_800_000_000_000,
      },
      pendingSnapshot: {
        protocolVersion: 1,
        taxonomyVersion: 1,
        pluginVersion: '0.2.2',
        revision: 8,
        dailyUsage: [],
        modelUsage: [],
        snapshotDigest: 'a'.repeat(64),
      },
      lastDigest: 'b'.repeat(64),
      lastSyncedAt: 1_800_000_000_000,
      lastError: 'old error',
    }

    expect(signedOutCommunityState(state)).toEqual({
      installationId: state.installationId,
      syncEnabled: false,
      acceptedRevision: 7,
      lastDigest: state.lastDigest,
      lastSyncedAt: state.lastSyncedAt,
    })
  })
})
